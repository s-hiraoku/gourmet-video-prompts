#!/usr/bin/env python3
"""音楽ファイルのテンポと拍の位置を調べる（フリー素材の BGM をカットに合わせるため）。

    python3 scripts/beats.py materials/bgm.mp3                 拍を検出して materials/bgm.beats.json に保存
    python3 scripts/beats.py materials/bgm.mp3 --start 12.5    曲の12.5秒目から使う場合

make_bgm.py で作った曲には最初から .beats.json が付いているので不要。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import FFMPEG  # noqa: E402

SR = 22050
HOP = 512


def load(path: Path, start: float) -> np.ndarray:
    r = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-ss", str(start), "-i", str(path),
                        "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4")


def onset_envelope(x: np.ndarray) -> np.ndarray:
    win = 2048
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::HOP] * np.hanning(win)
    mag = np.log1p(np.abs(np.fft.rfft(frames, axis=1)) * 10)
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode="same")  # ゆっくりした変化を除く
    return np.maximum(flux, 0)


def tempo(env: np.ndarray, lo=70, hi=160) -> float:
    fps = SR / HOP
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    lags = np.arange(len(ac))
    bpm = 60 * fps / np.maximum(lags, 1)
    mask = (bpm >= lo) & (bpm <= hi)
    # 人がよく感じる 100 BPM 付近を少しだけ優先する
    weight = np.exp(-0.5 * (np.log2(np.maximum(bpm, 1) / 100) / 0.9) ** 2)
    score = np.where(mask, ac * weight, 0)
    return float(bpm[np.argmax(score)])


def track_beats(env: np.ndarray, bpm: float, offset: float) -> list[float]:
    fps = SR / HOP
    period = 60 / bpm * fps
    best_phase, best = 0.0, -1.0
    for phase in np.linspace(0, period, 96, endpoint=False):
        idx = np.round(np.arange(phase, len(env), period)).astype(int)
        idx = idx[idx < len(env)]
        s = env[idx].sum()
        if s > best:
            best, best_phase = s, phase
    # 近くの強い立ち上がりに寄せてから、直線（一定テンポ）を当てはめてズレをならす
    snapped = []
    t = best_phase
    while t < len(env):
        lo, hi = int(max(0, t - period * 0.15)), int(min(len(env), t + period * 0.15 + 1))
        if hi > lo:
            snapped.append(lo + int(np.argmax(env[lo:hi])))
        t += period
    i = np.arange(len(snapped))
    slope, icpt = np.polyfit(i, np.array(snapped, dtype=float), 1)
    p_sec, t0 = slope / fps, icpt / fps + offset
    while t0 - p_sec >= -0.03:  # 曲の頭まで拍をさかのぼる
        t0 -= p_sec
    total = len(env) / fps
    return [round(max(0.0, t0 + k * p_sec), 4) for k in range(int((total - t0) / p_sec) + 1)]


def main() -> int:
    ap = argparse.ArgumentParser(description="BGM のテンポと拍の位置を検出します。")
    ap.add_argument("file", type=Path)
    ap.add_argument("--start", type=float, default=0.0, help="曲の何秒目から使うか（plan.json の bgm.start と同じ値）")
    a = ap.parse_args()
    x = load(a.file, a.start)
    env = onset_envelope(x)
    bpm = tempo(env)
    # 窓の中心で時刻を数えるための補正（onset は窓の後ろ寄りで検出される）
    beats = track_beats(env, bpm, offset=2048 / SR / 2)
    bpm = 60 * (len(beats) - 2) / (beats[-1] - beats[1]) if len(beats) > 2 else bpm
    downbeats = beats[::4]
    meta = {"file": a.file.name, "start": a.start, "bpm": round(bpm, 2), "seconds": round(len(x) / SR, 3), "beats": beats, "downbeats": downbeats}
    out = a.file.with_suffix(".beats.json")
    out.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{a.file.name}: 約 {bpm:.1f} BPM（拍の間隔 {60 / bpm:.3f}秒）、拍 {len(beats)} 個 → {out.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
