#!/usr/bin/env python3
"""plan.json のカット点を BGM の拍に合わせる（テロップもカットと一緒に動かす）。

    python3 scripts/sync_cuts.py work/plan.json --beats materials/bgm_lofi_jazz.beats.json
    python3 scripts/sync_cuts.py work/plan.json --beats materials/bgm.beats.json --grid 0.5   半拍にも合わせる

- すべてのカット点を拍（--grid 0.5 なら半拍）に置く。動かす量が最小になる置き方を探す
- 守る条件：1カット 0.8 秒以上／動画素材の長さを超えない／テロップの読む時間（文字数÷8＋0.3秒）
- 拍だけで条件を満たせない時は半拍も使う
- テロップの始まり・終わりがカット点と同じだったものは、新しいカット点に合わせて動かす
- 結果は上書き保存（元は plan.json.bak に残す）。最後に render.mjs --check で読みやすさを確かめること
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import ROOT, probe  # noqa: E402

MIN_CUT = 0.8


def main() -> int:
    ap = argparse.ArgumentParser(description="カット点を BGM の拍に合わせます。")
    ap.add_argument("plan", type=Path)
    ap.add_argument("--beats", type=Path, required=True)
    ap.add_argument("--grid", type=float, default=1.0, help="1 = 拍ごと、0.5 = 半拍ごと")
    ap.add_argument("--materials", type=Path, default=ROOT / "materials")
    a = ap.parse_args()

    plan = json.loads(a.plan.read_text(encoding="utf-8"))
    meta = json.loads(a.beats.read_text(encoding="utf-8"))
    beats = meta["beats"]
    if len(beats) < 2:
        sys.exit("拍が少なすぎます。")
    step = (beats[1] - beats[0]) * a.grid
    grid = []
    for i, b in enumerate(beats):
        grid.append(b)
        if a.grid < 1 and i + 1 < len(beats):
            grid.append((b + beats[i + 1]) / 2)

    clips = plan["clips"]
    old = [0.0]
    for c in clips:
        old.append(round(old[-1] + c["duration"], 4))
    total = old[-1]

    # 動画素材ごとに、使える最大の長さ（素材の長さ − in）÷ speed
    max_len = []
    for c in clips:
        if c.get("items") or str(c.get("source", "")).lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            max_len.append(1e9)
            continue
        info = probe(a.materials / c["source"])
        max_len.append((info["duration"] - c.get("in", 0)) / c.get("speed", 1))

    # テロップがどのカットからどのカットまでか（始まり・終わりがカット点と同じもの）と、読むのに必要な秒数
    idx_of = {round(v, 3): k for k, v in enumerate(old)}
    reading = []
    for t in plan.get("telops", []):
        a_i, b_i = idx_of.get(round(t.get("start", -1), 3)), idx_of.get(round(t.get("end", -1), 3))
        if a_i is None or b_i is None or t.get("type") in ("label", "title", "info"):
            continue
        n_chars = len(str(t.get("text", "")).replace("**", "").replace("\n", ""))
        need = max(1.0, n_chars / 8 + 0.3) if t.get("type") in ("plain", "caption") else 1.0
        reading.append((a_i, b_i, need))

    def solve(points):
        """全カット点を拍に置く。テロップの読む時間・カットの長さ・素材の長さを守りつつ、動かす量を最小にする。"""
        pts = [p for p in points if 0 < p < total - 1e-6]
        n = len(old) - 1
        states = {0.0: (0.0, [0.0])}
        for i in range(1, n + 1):
            cand = [total] if i == n else pts
            nxt = {}
            for p in cand:
                best = None
                for q, (cost, path) in states.items():
                    d = p - q
                    if d < MIN_CUT - 1e-6 or d > max_len[i - 1] + 1e-6:
                        continue
                    path2 = path + [p]
                    if any(b == i and path2[i] - path2[a] < need - 1e-6 for a, b, need in reading):
                        continue
                    c = cost + abs(p - old[i])
                    if best is None or c < best[0]:
                        best = (c, path2)
                if best:
                    nxt[p] = best
            states = nxt
            if not states:
                return None
        return min(states.values())[1]

    # 裏拍：スウィングしている曲は拍の真ん中ではなく少し後ろ（beats.json の swing）
    sw = meta.get("swing", 0.5)
    half = sorted(set(grid) | {round(b + (beats[k + 1] - b) * sw, 4) for k, b in enumerate(beats[:-1])})
    new = solve(grid) or (print("拍だけでは条件を満たせないため、半拍も使います。") or solve(half))
    if new is None:
        # 合わせられるテンポを探して提案する（make_bgm.py で作り直せる）
        ok = []
        for bars in range(2, 40):
            bpm = 60 * 4 * bars / total
            if not 72 <= bpm <= 110:
                continue
            bt = [round(k * 60 / bpm, 4) for k in range(bars * 4)]
            hb = sorted(set(bt) | {round((x + 30 / bpm), 4) for x in bt})
            if solve(bt):
                ok.append(f"{bpm:.1f} BPM（{bars}小節・拍ぴったり）")
            elif solve(hb):
                ok.append(f"{bpm:.1f} BPM（{bars}小節・半拍も使う）")
        hint = "\n  ".join(ok) if ok else "なし（尺を延ばすかテロップを分けてください）"
        sys.exit(f"このテンポでは条件を満たす合わせ方が見つかりませんでした。\n合わせられるテンポ:\n  {hint}\n"
                 f"例: python3 scripts/make_bgm.py --seconds {total:g} --bpm <上のテンポ>")

    moved = []
    for i, c in enumerate(clips):
        c["duration"] = round(new[i + 1] - new[i], 4)
    for i in range(1, len(old) - 1):
        if abs(new[i] - old[i]) > 1e-3:
            moved.append(f"{old[i]:.2f}→{new[i]:.2f}")

    remap = {round(o, 3): n for o, n in zip(old, new)}
    for key in ("telops", "stickers"):
        for t in plan.get(key, []):
            for f in ("start", "end"):
                v = t.get(f)
                if isinstance(v, (int, float)) and round(v, 3) in remap:
                    t[f] = remap[round(v, 3)]

    bgm = plan.setdefault("bgm", {})
    bgm.setdefault("file", meta["file"])
    if "start" in meta:
        bgm.setdefault("start", meta["start"])
    shutil.copy(a.plan, a.plan.with_suffix(a.plan.suffix + ".bak"))
    a.plan.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    on = sum(1 for x in new[1:-1] if any(abs(x - g) < 1e-3 for g in grid))
    on_half = sum(1 for x in new[1:-1] if any(abs(x - g) < 1e-3 for g in half)) - on
    print(f"テンポ {meta.get('bpm')} BPM：カット点 {len(new) - 2} 個 → 拍の上 {on} 個、半拍（裏拍）{on_half} 個")
    print("動かしたカット点: " + (", ".join(moved) if moved else "なし"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
