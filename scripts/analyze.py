#!/usr/bin/env python3
"""素材（動画・写真）を Claude が「見て」選べるように、コマ画像と情報をまとめる。

    python3 scripts/analyze.py                         materials の全素材を分析
    python3 scripts/analyze.py materials/v3.mp4 --range 2:5 --step 0.1
                                                       指定範囲を細かく見る（IN/OUT を決めるとき）
    python3 scripts/analyze.py output/reel.mp4 --step 0.25
                                                       完成動画のチェック

出力: work/analysis/<素材名>.jpg（秒数入りのコマ一覧）と work/analysis/summary.md
"""
from __future__ import annotations

import argparse
import array
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont, ImageOps
except ImportError:
    sys.exit("Pillow が見つかりません。`pip install -r requirements.txt` を実行してください。")

ROOT = Path(__file__).resolve().parent.parent
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
THUMB_H = 360
COLS = 6


def ffmpeg_exe() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ffmpeg が見つかりません。`pip install -r requirements.txt` を実行してください。")


FFMPEG = ffmpeg_exe()


def label_font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def probe(path: Path) -> dict:
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True, errors="replace")
    info = {"duration": 0.0, "width": 0, "height": 0, "fps": 0.0, "audio": False, "rotation": 0, "hdr": False, "codec": ""}
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    if m:
        info["duration"] = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    v = re.search(r"Stream #\S+.*Video: (\w+)[^\n]*?, (\d{2,5})x(\d{2,5})[^\n]*", r.stderr)
    if v:
        info["codec"], info["width"], info["height"] = v[1], int(v[2]), int(v[3])
        f = re.search(r"([\d.]+) fps", v[0])
        info["fps"] = float(f[1]) if f else 0.0
        info["hdr"] = bool(re.search(r"arib-std-b67|smpte2084|bt2020", v[0]))
    rot = re.search(r"rotation of (-?[\d.]+)", r.stderr) or re.search(r"rotate\s*:\s*(-?\d+)", r.stderr)
    if rot:
        info["rotation"] = int(float(rot[1]))
    if abs(info["rotation"]) % 180 == 90:
        info["width"], info["height"] = info["height"], info["width"]
    info["audio"] = bool(re.search(r"Stream #\S+.*Audio:", r.stderr))
    return info


def extract_frames(path: Path, start: float, end: float, step: float) -> list[tuple[float, Image.Image]]:
    frames = []
    t = start
    times = []
    while t <= end + 1e-6:
        times.append(round(t, 3))
        t += step
    for ts in times:
        r = subprocess.run(
            [FFMPEG, "-hide_banner", "-loglevel", "error", "-ss", f"{ts:.3f}", "-i", str(path),
             "-frames:v", "1", "-vf", f"scale=-2:{THUMB_H}", "-f", "image2pipe", "-vcodec", "png", "-"],
            capture_output=True,
        )
        if r.returncode == 0 and r.stdout:
            from io import BytesIO

            frames.append((ts, Image.open(BytesIO(r.stdout)).convert("RGB")))
    return frames


def loudness(path: Path, start: float, end: float, step: float) -> list[float]:
    """step 秒ごとの音量（dBFS）。咀嚼音・ジュージュー音など、音の山を探す用。"""
    r = subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-ss", f"{start:.3f}", "-t", f"{end - start + step:.3f}",
         "-i", str(path), "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
        capture_output=True,
    )
    samples = array.array("h", r.stdout[: len(r.stdout) // 2 * 2])
    per = max(1, int(8000 * step))
    out = []
    for i in range(0, len(samples), per):
        chunk = samples[i : i + per]
        if not chunk:
            break
        rms = math.sqrt(sum(s * s for s in chunk) / len(chunk)) / 32768
        out.append(20 * math.log10(rms) if rms > 0 else -90.0)
    return out


def sheet(name: str, frames: list[tuple[float, Image.Image]], out: Path) -> None:
    if not frames:
        return
    w = max(im.width for _, im in frames)
    rows = math.ceil(len(frames) / COLS)
    pad = 6
    canvas = Image.new("RGB", (COLS * (w + pad) + pad, rows * (THUMB_H + pad) + pad), "#111")
    draw = ImageDraw.Draw(canvas)
    font = label_font(26)
    for i, (ts, im) in enumerate(frames):
        x = pad + (i % COLS) * (w + pad)
        y = pad + (i // COLS) * (THUMB_H + pad)
        canvas.paste(im, (x + (w - im.width) // 2, y))
        text = f"{name} {ts:.2f}s"
        tw = draw.textlength(text, font=font)
        draw.rectangle([x, y, x + tw + 12, y + 34], fill=(0, 0, 0))
        draw.text((x + 6, y + 3), text, fill=(255, 230, 80), font=font)
    canvas.save(out, quality=88)


def convert_heic(path: Path) -> Path | None:
    try:
        import pillow_heif

        pillow_heif.register_heif_opener()
    except ImportError:
        return None
    dst = path.with_suffix(".jpg")
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    im.save(dst, quality=95)
    return dst


def analyze_video(path: Path, outdir: Path, rng: tuple[float, float] | None, step: float | None) -> str:
    info = probe(path)
    dur = info["duration"]
    start, end = rng if rng else (0.0, max(0.0, dur - 0.05))
    end = min(end, max(0.0, dur - 0.05))
    if step is None:
        span = end - start
        step = 0.5 if span <= 15 else 1.0 if span <= 36 else round(span / 36, 1)
    frames = extract_frames(path, start, end, step)
    suffix = f"_{start:g}-{end:g}" if rng else ""
    img = outdir / f"{path.stem}{suffix}.jpg"
    sheet(path.stem, frames, img)

    orient = "縦" if info["height"] > info["width"] else "横" if info["width"] > info["height"] else "正方形"
    lines = [
        f"## {path.name}",
        f"- 長さ {dur:.2f}秒 / {info['width']}x{info['height']}（{orient}） / {info['fps']:.0f}fps / {info['codec']}"
        f" / 音声{'あり' if info['audio'] else 'なし'}{' / HDR' if info['hdr'] else ''}",
        f"- コマ一覧: {img.relative_to(ROOT)}（{step:g}秒ごと、{len(frames)}枚）",
    ]
    if info["audio"]:
        db = loudness(path, start, end, step)
        if db:
            bars = " ".join(f"{start + i * step:.1f}:{'▁▂▃▄▅▆▇█'[max(0, min(7, int((d + 50) / 6)))]}" for i, d in enumerate(db))
            peak = max(range(len(db)), key=lambda i: db[i])
            lines.append(f"- 音量（高いほど大きい。咀嚼音・焼き音の目安）: {bars}")
            lines.append(f"- 一番音が大きいのは {start + peak * step:.1f}秒付近（{db[peak]:.0f} dBFS）")
    return "\n".join(lines)


def analyze_photos(photos: list[Path], outdir: Path) -> str:
    items = []
    lines = ["## 写真"]
    for p in photos:
        src = p
        if p.suffix.lower() in {".heic", ".heif"}:
            if p.with_suffix(".jpg") in photos:
                continue  # 変換済み
            conv = convert_heic(p)
            if conv is None:
                lines.append(f"- {p.name}: HEIC です。`pip install pillow-heif` 後にもう一度実行すると JPEG に変換します。")
                continue
            lines.append(f"- {p.name} → {conv.name} に変換しました（plan.json では {conv.name} を使う）")
            src = conv
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        orient = "縦" if im.height > im.width else "横" if im.width > im.height else "正方形"
        lines.append(f"- {src.name}: {im.width}x{im.height}（{orient}）")
        im.thumbnail((THUMB_H * 2, THUMB_H))
        items.append((src.stem, im))
    if items:
        w = max(im.width for _, im in items)
        rows = math.ceil(len(items) / COLS)
        canvas = Image.new("RGB", (COLS * (w + 6) + 6, rows * (THUMB_H + 6) + 6), "#111")
        draw = ImageDraw.Draw(canvas)
        font = label_font(26)
        for i, (name, im) in enumerate(items):
            x = 6 + (i % COLS) * (w + 6)
            y = 6 + (i // COLS) * (THUMB_H + 6)
            canvas.paste(im, (x + (w - im.width) // 2, y + (THUMB_H - im.height) // 2))
            draw.rectangle([x, y, x + draw.textlength(name, font=font) + 12, y + 34], fill=(0, 0, 0))
            draw.text((x + 6, y + 3), name, fill=(255, 230, 80), font=font)
        out = outdir / "photos.jpg"
        canvas.save(out, quality=88)
        lines.append(f"- 写真一覧: {out.relative_to(ROOT)}")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="素材を分析して、コマ一覧画像と summary.md を作ります。")
    ap.add_argument("files", nargs="*", type=Path, help="分析するファイル（省略時は materials の全部）")
    ap.add_argument("--range", help="動画の範囲 開始:終了（秒）。例 2:5")
    ap.add_argument("--step", type=float, help="何秒ごとにコマを取るか（例 0.1）")
    ap.add_argument("--out", type=Path, default=ROOT / "work" / "analysis")
    a = ap.parse_args()

    files = a.files or sorted(p for p in (ROOT / "materials").iterdir() if p.is_file() and not p.name.startswith("."))
    rng = tuple(float(x) for x in a.range.split(":")) if a.range else None
    a.out.mkdir(parents=True, exist_ok=True)

    videos = [f for f in files if f.suffix.lower() in VIDEO_EXTS]
    photos = [f for f in files if f.suffix.lower() in PHOTO_EXTS]
    others = [f for f in files if f not in videos and f not in photos]

    parts = [analyze_video(v.resolve(), a.out, rng, a.step) for v in videos]
    if photos:
        parts.append(analyze_photos([p.resolve() for p in photos], a.out))
    if others:
        parts.append("## その他\n" + "\n".join(f"- {o.name}" for o in others))

    report = "# 素材分析\n\n" + "\n\n".join(parts) + "\n"
    if not a.files:
        (a.out / "summary.md").write_text(report, encoding="utf-8")
    print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
