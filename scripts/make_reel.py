#!/usr/bin/env python3
"""AIが出力した編集データ(plan.json)から、インスタ用の縦型リール動画(mp4)を自動で作る。

使い方:
    python3 scripts/make_reel.py plan.json
    python3 scripts/make_reel.py plan.json --materials materials --out output/reel.mp4

必要なもの: Python 3.9+ / Pillow / ffmpeg（なければ imageio-ffmpeg を自動で使う）
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow が見つかりません。`pip install -r requirements.txt` を実行してください。")

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# 日本語が表示できるフォントの候補（上から順に探す）
FONT_CANDIDATES = [
    # macOS
    "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    # Windows
    "C:/Windows/Fonts/YuGothB.ttc",
    "C:/Windows/Fonts/meiryob.ttc",
    "C:/Windows/Fonts/msgothic.ttc",
    # Linux
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
]

# テロップのスタイル（font: 画面幅に対する文字サイズ比）
STYLES = {
    "hook":   {"font": 0.085, "fill": "#FFE14D", "stroke": "#000000", "stroke_w": 0.12, "box": None},
    "normal": {"font": 0.065, "fill": "#FFFFFF", "stroke": "#000000", "stroke_w": 0.12, "box": None},
    "accent": {"font": 0.070, "fill": "#FF5A36", "stroke": "#FFFFFF", "stroke_w": 0.12, "box": None},
    "info":   {"font": 0.050, "fill": "#FFFFFF", "stroke": None,      "stroke_w": 0,    "box": (0, 0, 0, 170)},
    "pr":     {"font": 0.035, "fill": "#FFFFFF", "stroke": None,      "stroke_w": 0,    "box": (0, 0, 0, 140)},
}

# 画面上の縦位置（テキスト中心）。下はインスタのボタン・キャプションに隠れないよう高めにしている
POSITIONS = {"top": 0.20, "center": 0.50, "bottom": 0.68}
MOTIONS = {"none", "zoom_in", "zoom_out", "pan_left", "pan_right"}


class PlanError(Exception):
    pass


def find_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ffmpeg が見つかりません。`pip install -r requirements.txt` を実行してください。")


def find_font(explicit: str | None) -> str:
    if explicit:
        if not Path(explicit).exists():
            raise PlanError(f"フォントが見つかりません: {explicit}")
        return explicit
    for cand in FONT_CANDIDATES:
        if Path(cand).exists():
            return cand
    raise PlanError("日本語フォントが見つかりません。--font でフォントファイルを指定してください。")


def resolve_source(name: str, materials: Path) -> Path:
    """"v1" のように拡張子なしでも、materials フォルダから探す。"""
    p = materials / name
    if p.is_file():
        return p
    matches = sorted(q for q in materials.glob(f"{Path(name).stem}.*") if q.is_file())
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise PlanError(f"素材 '{name}' に当てはまるファイルが複数あります: {[m.name for m in matches]}")
    raise PlanError(f"素材 '{name}' が {materials} に見つかりません。")


def num(value, field: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise PlanError(f"{field} は数値で指定してください（今: {value!r}）")
    return float(value)


def read_plan_json(path: Path) -> dict:
    if not path.exists():
        raise PlanError(f"{path} が見つかりません。")
    text = path.read_text(encoding="utf-8-sig").strip()
    # AIの回答を ```json ... ``` ごとコピーした場合も読めるようにする
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1)
    try:
        plan = json.loads(text)
    except json.JSONDecodeError as e:
        raise PlanError(f"{path.name} の書き方が正しくありません（{e.lineno}行目）: {e.msg}")
    if not isinstance(plan, dict):
        raise PlanError(f"{path.name} の中身が編集データの形になっていません。")
    return plan


def load_plan(plan: dict, materials: Path) -> dict:
    clips = plan.get("clips")
    if not isinstance(clips, list) or not clips:
        raise PlanError("clips（使う素材の並び）が空です。")

    for i, c in enumerate(clips, 1):
        where = f"clips[{i}]"
        if "source" not in c:
            raise PlanError(f"{where}: source（素材名）がありません。")
        c["_path"] = resolve_source(str(c["source"]), materials)
        ext = c["_path"].suffix.lower()
        kind = c.get("type") or ("photo" if ext in PHOTO_EXTS else "video")
        if kind not in ("video", "photo"):
            raise PlanError(f"{where}: type は video か photo です（今: {kind!r}）")
        c["type"] = kind
        if kind == "video":
            start = num(c.get("in", 0), f"{where}.in")
            if "out" in c:
                dur = num(c["out"], f"{where}.out") - start
            else:
                dur = num(c.get("duration"), f"{where}.duration")
            c["_in"] = start
        else:
            dur = num(c.get("duration", 1.5), f"{where}.duration")
            motion = c.get("motion", "zoom_in")
            if motion not in MOTIONS:
                raise PlanError(f"{where}: motion は {sorted(MOTIONS)} のどれかです（今: {motion!r}）")
            c["motion"] = motion
        if dur <= 0:
            raise PlanError(f"{where}: 長さが0秒以下です。")
        c["_dur"] = dur

    total = sum(c["_dur"] for c in clips)
    plan["_total"] = total

    for i, t in enumerate(plan.get("telops", []), 1):
        where = f"telops[{i}]"
        if not str(t.get("text", "")).strip():
            raise PlanError(f"{where}: text（文言）が空です。")
        t["_start"] = num(t.get("start"), f"{where}.start")
        t["_end"] = min(num(t.get("end"), f"{where}.end"), total)
        if t["_end"] <= t["_start"]:
            raise PlanError(f"{where}: end は start より後、かつ動画の長さ({total:.1f}秒)以内にしてください。")
        if t.get("style", "normal") not in STYLES:
            raise PlanError(f"{where}: style は {list(STYLES)} のどれかです。")
        if t.get("position", "center") not in POSITIONS:
            raise PlanError(f"{where}: position は {list(POSITIONS)} のどれかです。")

    bgm = plan.get("bgm")
    if bgm and bgm.get("file"):
        bgm["_path"] = resolve_source(bgm["file"], materials)
    return plan


def render_telop(t: dict, font_path: str, w: int, h: int, out: Path) -> None:
    """テロップ1枚を、画面サイズの透明PNGとして描く。"""
    style = STYLES[t.get("style", "normal")]
    lines = str(t["text"]).split("\n")
    max_w = w * 0.88
    size = int(w * style["font"])

    while True:
        font = ImageFont.truetype(font_path, size)
        stroke = int(size * style["stroke_w"])
        widths = [font.getbbox(line, stroke_width=stroke)[2] for line in lines]
        if max(widths) <= max_w or size <= 24:
            break
        size -= 2  # 横幅に収まるまで小さくする

    line_h = int(size * 1.3)
    block_h = line_h * len(lines)
    cy = h * POSITIONS[t.get("position", "center")]
    top = int(cy - block_h / 2)

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if style["box"]:
        pad = int(size * 0.45)
        bw = max(widths)
        draw.rounded_rectangle(
            [(w - bw) / 2 - pad, top - pad, (w + bw) / 2 + pad, top + block_h + pad * 0.6],
            radius=pad, fill=style["box"],
        )
    for i, line in enumerate(lines):
        draw.text(
            ((w - widths[i]) / 2, top + i * line_h), line, font=font, fill=style["fill"],
            stroke_width=stroke, stroke_fill=style["stroke"],
        )
    img.save(out)


def has_audio(ffmpeg: str, path: Path) -> bool:
    r = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return bool(re.search(r"Stream #\S+.*Audio:", r.stderr))


def photo_filter(motion: str, dur: float, w: int, h: int, fps: int) -> str:
    frames = max(int(round(dur * fps)), 1)
    # ガタつき防止のため一度大きく拡大してから zoompan する
    base = f"scale={w * 2}:{h * 2}:force_original_aspect_ratio=increase,crop={w * 2}:{h * 2},setsar=1"
    center = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    z = {
        "none": ("1", center),
        "zoom_in": (f"1+0.12*on/{frames}", center),
        "zoom_out": (f"1.12-0.12*on/{frames}", center),
        "pan_left": ("1.12", f"x='(iw-iw/zoom)*(1-on/{frames})':y='ih/2-(ih/zoom/2)'"),
        "pan_right": ("1.12", f"x='(iw-iw/zoom)*on/{frames}':y='ih/2-(ih/zoom/2)'"),
    }[motion]
    return f"{base},zoompan=z='{z[0]}':{z[1]}:d=1:s={w}x{h}:fps={fps}"


def build_command(plan: dict, ffmpeg: str, telop_pngs: list[Path], out: Path) -> list[str]:
    w, h, fps = plan["_w"], plan["_h"], plan["_fps"]
    orig_vol = float(plan.get("bgm", {}).get("original_volume", 1.0)) if plan.get("bgm") else 1.0
    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    filters, concat_in = [], []
    idx = 0

    for n, c in enumerate(plan["clips"]):
        dur = c["_dur"]
        if c["type"] == "video":
            args += ["-ss", f"{c['_in']:.3f}", "-t", f"{dur + 0.5:.3f}", "-i", str(c["_path"])]
            v = (f"[{idx}:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,"
                 f"fps={fps},tpad=stop_mode=clone:stop_duration={dur:.3f},"
                 f"trim=duration={dur:.3f},setpts=PTS-STARTPTS,format=yuv420p[v{n}]")
            use_audio = c.get("keep_audio", True) and has_audio(ffmpeg, c["_path"])
        else:
            args += ["-loop", "1", "-framerate", str(fps), "-t", f"{dur + 0.5:.3f}", "-i", str(c["_path"])]
            v = (f"[{idx}:v]{photo_filter(c['motion'], dur, w, h, fps)},"
                 f"trim=duration={dur:.3f},setpts=PTS-STARTPTS,format=yuv420p[v{n}]")
            use_audio = False
        filters.append(v)
        if use_audio:
            filters.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,"
                           f"volume={orig_vol},apad,atrim=duration={dur:.3f},asetpts=PTS-STARTPTS[a{n}]")
        else:
            filters.append(f"anullsrc=r=44100:cl=stereo,atrim=duration={dur:.3f}[a{n}]")
        concat_in.append(f"[v{n}][a{n}]")
        idx += 1

    filters.append(f"{''.join(concat_in)}concat=n={len(plan['clips'])}:v=1:a=1[vcat][acat]")

    last = "vcat"
    for k, (t, png) in enumerate(zip(plan.get("telops", []), telop_pngs)):
        args += ["-i", str(png)]
        filters.append(f"[{last}][{idx}:v]overlay=0:0:"
                       f"enable='between(t,{t['_start']:.3f},{t['_end']:.3f})'[vt{k}]")
        last = f"vt{k}"
        idx += 1

    audio = "acat"
    bgm = plan.get("bgm")
    if bgm and bgm.get("_path"):
        args += ["-stream_loop", "-1", "-i", str(bgm["_path"])]
        total = plan["_total"]
        fade = min(1.0, total / 4)
        filters.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,"
                       f"atrim=start={float(bgm.get('start', 0)):.3f},asetpts=PTS-STARTPTS,"
                       f"atrim=duration={total:.3f},volume={float(bgm.get('volume', 0.3))},"
                       f"afade=t=out:st={total - fade:.3f}:d={fade:.3f}[bgm]")
        filters.append("[acat][bgm]amix=inputs=2:duration=first:normalize=0[amix]")
        audio = "amix"

    args += ["-filter_complex", ";".join(filters), "-map", f"[{last}]", "-map", f"[{audio}]",
             "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
             "-r", str(fps), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
             "-t", f"{plan['_total']:.3f}", str(out)]
    return args


def main() -> int:
    ap = argparse.ArgumentParser(description="plan.json からインスタ用リール動画を作ります。")
    ap.add_argument("plan", type=Path, help="AIが出力した編集データ（JSON）")
    ap.add_argument("--materials", type=Path, help="素材フォルダ（省略時は plan.json の materials_dir、なければ plan.json と同じ場所の materials）")
    ap.add_argument("--out", type=Path, help="出力先（省略時は plan.json の output、なければ plan.json と同じ場所の output/reel.mp4）")
    ap.add_argument("--font", help="テロップに使うフォントファイル（省略時は自動で探す）")
    ap.add_argument("--check", action="store_true", help="動画は作らず、plan.json の中身だけチェックする")
    a = ap.parse_args()

    try:
        # 素材フォルダと出力先は、指定がなければ plan.json と同じ場所を基準にする
        plan_dir = a.plan.resolve().parent
        raw = read_plan_json(a.plan)
        materials = a.materials or plan_dir / raw.get("materials_dir", "materials")
        out = a.out or plan_dir / raw.get("output", "output/reel.mp4")
        if not materials.is_dir():
            raise PlanError(f"素材フォルダ {materials} が見つかりません。")

        plan = load_plan(raw, materials)
        plan["_w"], plan["_h"] = int(plan.get("width", 1080)), int(plan.get("height", 1920))
        plan["_fps"] = int(plan.get("fps", 30))
        font = find_font(a.font)

        target = plan.get("duration")
        print(f"素材 {len(plan['clips'])} 個 / テロップ {len(plan.get('telops', []))} 枚 / 合計 {plan['_total']:.2f} 秒")
        if target and abs(float(target) - plan["_total"]) > 0.05:
            print(f"注意: 指定の尺 {target} 秒と、素材の合計 {plan['_total']:.2f} 秒が一致していません。")
        if a.check:
            print("チェックOK")
            return 0

        ffmpeg = find_ffmpeg()
        out.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            pngs = []
            for k, t in enumerate(plan.get("telops", [])):
                png = Path(tmp) / f"telop_{k}.png"
                render_telop(t, font, plan["_w"], plan["_h"], png)
                pngs.append(png)
            cmd = build_command(plan, ffmpeg, pngs, out)
            print("動画を書き出しています…")
            r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode != 0:
                print(r.stderr, file=sys.stderr)
                raise PlanError("ffmpeg でエラーが出ました（上のメッセージを確認してください）。")
        print(f"完成: {out}")
        return 0
    except PlanError as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
