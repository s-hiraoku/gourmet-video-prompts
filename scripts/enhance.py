#!/usr/bin/env python3
"""低画質（1080p 未満）の動画を、書き出し前に高画質化する。

    python3 scripts/enhance.py              materials の 1080p 未満の動画をすべて処理
    python3 scripts/enhance.py materials/v4.mp4

軽いノイズ除去 → Lanczos で 1080 幅に拡大 → Contrast Adaptive Sharpen で輪郭を立てる。
出力は materials/<名前>_hd.mp4（元ファイルはそのまま）。plan.json では _hd の方を使う。
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import FFMPEG, ROOT, VIDEO_EXTS, probe  # noqa: E402

TARGET = 1080  # 短い辺をこの大きさにする


def enhance(src: Path) -> Path | None:
    info = probe(src)
    short = min(info["width"], info["height"])
    if short >= TARGET or short == 0:
        return None
    dst = src.with_name(f"{src.stem}_hd.mp4")
    portrait = info["height"] >= info["width"]
    size = f"{TARGET}:-2" if portrait else f"-2:{TARGET}"
    vf = f"hqdn3d=1.2:1.2:4:4,scale={size}:flags=lanczos,cas=0.55,format=yuv420p"
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-vf", vf,
           "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-c:a", "copy", "-movflags", "+faststart", str(dst)]
    subprocess.run(cmd, check=True)
    return dst


def main() -> int:
    ap = argparse.ArgumentParser(description="1080p 未満の動画を高画質化して <名前>_hd.mp4 を作ります。")
    ap.add_argument("files", nargs="*", type=Path)
    a = ap.parse_args()
    files = a.files or sorted(
        p for p in (ROOT / "materials").iterdir()
        if p.suffix.lower() in VIDEO_EXTS and not p.stem.endswith("_hd")
    )
    for f in files:
        out = enhance(f.resolve())
        print(f"{f.name} → {out.name}" if out else f"{f.name}: 1080p 以上なのでそのまま")
    return 0


if __name__ == "__main__":
    sys.exit(main())
