#!/usr/bin/env python3
"""オリジナルの BGM をプログラムで作曲・合成する（著作権の心配なし）。

    python3 scripts/make_bgm.py --seconds 20                  20秒ちょうどで終わる曲（テンポは自動）
    python3 scripts/make_bgm.py --seconds 15 --style lofi_jazz --bpm 90 --seed 3

出力: materials/bgm_<style>.wav と、拍の位置 materials/bgm_<style>.beats.json
（beats.json は scripts/sync_cuts.py でカットを拍に合わせるのに使う）

スタイル:
  lofi_jazz  エレピ（ローズ風）＋ウッドベース風＋ブラシのドラム＋レコードのノイズ。高級店・夜・和食に
  bossa      ナイロンギター風の分散和音＋軽いパーカッション。カフェ・スイーツ・昼に
"""
from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SR = 44100


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def env_exp(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t * decay)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


class Track:
    def __init__(self, seconds: float):
        self.n = int(seconds * SR) + SR * 3  # 余韻用に少し長く確保
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def add(self, t: float, sig: np.ndarray, gain: float = 1.0, pan: float = 0.0):
        i = int(t * SR)
        if i >= self.n:
            return
        sig = sig[: self.n - i] * gain
        self.L[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
        self.R[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


# ---- 音色 ----------------------------------------------------------------

def rhodes(freq: float, dur: float, vel: float = 0.8) -> np.ndarray:
    """FM で作るローズ風エレピ：叩いた瞬間は金属的で、すぐ丸い音になる。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    index = (1.6 * vel) * np.exp(-t * 6) + 0.25
    car = np.sin(2 * np.pi * freq * t + index * np.sin(2 * np.pi * freq * t))
    tine = 0.18 * vel * np.sin(2 * np.pi * freq * 4.0 * t) * np.exp(-t * 14)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.6 * t)
    env = env_exp(n, 0.004, 1.6) * 0.85 + env_exp(n, 0.004, 0.5) * 0.15
    release = np.clip((dur - t) / 0.08, 0, 1)
    return (car + tine) * env * trem * release * vel


def upright(freq: float, dur: float, vel: float = 0.9) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) + 0.12 * np.sin(2 * np.pi * 3 * freq * t)
    thump = 0.5 * np.sin(2 * np.pi * freq * 0.5 * t) * np.exp(-t * 30)
    env = env_exp(n, 0.008, 1.4)
    release = np.clip((dur - t) / 0.05, 0, 1)
    return np.tanh((x + thump) * env * 1.4) * release * vel


def nylon(freq: float, dur: float, vel: float = 0.8) -> np.ndarray:
    """カープラス・ストロングで作るナイロン弦ギター風。"""
    n = int(dur * SR)
    period = max(2, int(SR / freq))
    rng = np.random.default_rng(int(freq * 100))
    buf = rng.uniform(-1, 1, period)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.4985 * (buf[i % period] + buf[(i + 1) % period])
    return lowpass(out, 3200) * vel * np.clip((dur - np.arange(n) / SR) / 0.05, 0, 1)


def pad(freq: float, dur: float) -> np.ndarray:
    """ゆっくり立ち上がる柔らかいパッド（音のすき間を埋める）。少しずらした2音でうねりを出す。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * freq * d * t) + 0.3 * np.sin(2 * np.pi * 2 * freq * d * t) for d in (0.998, 1.002))
    att = np.clip(t / 0.35, 0, 1)
    rel = np.clip((dur - t) / 0.4, 0, 1)
    return x * att * rel * 0.5


def kick(vel=1.0):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 48 + 70 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * vel


def brush_snare(rng, vel=1.0):
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    noise = bandpass(rng.uniform(-1, 1, n), 900, 5000) * np.exp(-t * 14)
    body = 0.3 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (noise * 0.9 + body) * vel


def hat(rng, vel=1.0, open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return highpass(rng.uniform(-1, 1, n), 7000) * np.exp(-t * (18 if open_ else 70)) * vel


def shaker(rng, vel=1.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    a = np.clip(t / 0.02, 0, 1) * np.exp(-t * 40)
    return bandpass(rng.uniform(-1, 1, n), 4000, 11000) * a * vel


# ---- 曲 ------------------------------------------------------------------

# ii-V-I-VI（ドリアンっぽく落ち着いた進行）。ルート（ベース）と、ルートなしの和音
PROGRESSIONS = {
    "lofi_jazz": [
        (38, [53, 57, 60, 64]),  # Dm9
        (43, [53, 59, 64, 69]),  # G13
        (36, [52, 55, 59, 62]),  # Cmaj9
        (45, [49, 55, 58, 61]),  # A7(b9)
    ],
    "bossa": [
        (41, [57, 60, 64, 67]),  # Fmaj9
        (40, [55, 58, 62, 65]),  # Em7(b5)→
        (45, [55, 61, 64, 67]),  # A7
        (38, [53, 57, 60, 64]),  # Dm9
    ],
}


def compose(style: str, bpm: float, bars: int, seed: int) -> tuple[np.ndarray, list[float], list[float]]:
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    total = bars * 4 * beat
    tr = Track(total)
    prog = PROGRESSIONS[style]
    swing = 0.62  # 8分のスウィング（0.5 = まっすぐ）

    def eighth(bar, b, half):
        base = (bar * 4 + b) * beat
        return base + (beat * swing if half else 0.0)

    penta = [62, 65, 67, 69, 72, 74, 77]  # D マイナーペンタ（上の旋律用）
    for bar in range(bars):
        last = bar == bars - 1
        root, chord = prog[bar % len(prog)]
        if last:
            root, chord = prog[2]  # 最後は落ち着く和音（I）で終わる
        if style == "lofi_jazz":
            # エレピ：1拍目は長く、2拍目の裏で短く（最後の小節はのばして余韻）
            for k, m in enumerate(chord):
                tr.add(eighth(bar, 0, False) + k * 0.012, rhodes(midi_hz(m), beat * (6 if last else 2.6), 0.55), 0.22, -0.25 + 0.15 * k)
                if not last:
                    tr.add(eighth(bar, 1, True), rhodes(midi_hz(m), beat * 0.9, 0.45), 0.16, -0.2 + 0.12 * k)
            # パッド：小節いっぱいに薄く敷く
            for k, m in enumerate(chord):
                tr.add(eighth(bar, 0, False), pad(midi_hz(m), beat * (6 if last else 4.3)), 0.08, -0.4 + 0.27 * k)
            # 上の旋律：1小節に2〜3音、まばらに
            if not last:
                for b, half in [(2, False), (3, True)] if bar % 2 == 0 else [(2, True), (3, False), (3, True)]:
                    if rng.random() < 0.8:
                        m = int(rng.choice(penta)) + 12
                        tr.add(eighth(bar, b, half), rhodes(midi_hz(m), beat * 0.8, 0.5), 0.13, 0.3)
            # ベース：1拍目ルート、3拍目5度、4拍目裏で次へのアプローチ
            tr.add(eighth(bar, 0, False), upright(midi_hz(root), beat * (4 if last else 1.8)), 0.5)
            if not last:
                tr.add(eighth(bar, 2, False), upright(midi_hz(root + 7), beat * 1.2), 0.42)
                nxt = prog[(bar + 1) % len(prog)][0]
                tr.add(eighth(bar, 3, True), upright(midi_hz(nxt + (1 if nxt < root else -1)), beat * 0.5), 0.3)
            # ドラム：ローファイなキック、ブラシのスネア、スウィングのハイハット
            if not last:
                tr.add(eighth(bar, 0, False), kick(), 0.55)
                tr.add(eighth(bar, 2, True), kick(0.8), 0.45)
                tr.add(eighth(bar, 1, False), brush_snare(rng), 0.28, 0.1)
                tr.add(eighth(bar, 3, False), brush_snare(rng), 0.28, 0.1)
                for b in range(4):
                    for half in (False, True):
                        tr.add(eighth(bar, b, half), hat(rng, 0.6 if half else 1.0), 0.06, 0.35)
            else:
                tr.add(eighth(bar, 0, False), kick(0.7), 0.4)
        else:  # bossa
            pattern = [(0, False), (0, True), (1, True), (2, False), (2, True), (3, True)]
            for i, (b, half) in enumerate(pattern if not last else [(0, False)]):
                m = chord[i % len(chord)] if i else root + 12
                tr.add(eighth(bar, b, half), nylon(midi_hz(m), beat * (4 if last else 1.2)), 0.35, -0.2 + 0.1 * i)
            tr.add(eighth(bar, 0, False), upright(midi_hz(root), beat * (4 if last else 1.4)), 0.45)
            if not last:
                tr.add(eighth(bar, 2, False), upright(midi_hz(root + 7), beat * 1.2), 0.38)
                for b in range(4):
                    for half in (False, True):
                        tr.add(eighth(bar, b, half), shaker(rng, 1.0 if half else 0.6), 0.08, 0.3)
                tr.add(eighth(bar, 1, True), brush_snare(rng, 0.6), 0.15)
                tr.add(eighth(bar, 3, False), brush_snare(rng, 0.6), 0.15)

    # レコードのノイズ（ローファイ感）
    if style == "lofi_jazz":
        hiss = lowpass(rng.normal(0, 1, tr.n), 5000) * 0.004
        crackle = np.zeros(tr.n)
        idx = rng.integers(0, tr.n, int(tr.n / SR * 18))
        crackle[idx] = rng.uniform(-1, 1, len(idx))
        crackle = bandpass(crackle, 1500, 9000) * 0.25
        tr.L += hiss + crackle
        tr.R += hiss + crackle * 0.8

    mix = np.stack([tr.L, tr.R])
    mix = lowpass(mix, 7500 if style == "lofi_jazz" else 11000)
    mix = np.tanh(mix * 1.6) / 1.6
    end = int(total * SR)
    mix = mix[:, :end]
    fade_in = int(0.12 * SR)
    mix[:, :fade_in] *= np.linspace(0, 1, fade_in)
    fade_out = int(min(1.6, total / 6) * SR)
    mix[:, -fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
    mix /= max(1e-9, np.abs(mix).max()) / 0.85
    beats = [round(i * beat, 4) for i in range(bars * 4)]
    downbeats = [round(i * 4 * beat, 4) for i in range(bars)]
    return mix, beats, downbeats


def write_wav(path: Path, mix: np.ndarray):
    data = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main() -> int:
    ap = argparse.ArgumentParser(description="オリジナル BGM を作曲・合成します。")
    ap.add_argument("--seconds", type=float, default=15, help="曲の長さ（動画の尺）")
    ap.add_argument("--style", choices=sorted(PROGRESSIONS), default="lofi_jazz")
    ap.add_argument("--bpm", type=float, help="テンポ（省略時は尺がちょうど小節で割り切れるテンポを 76〜96 から選ぶ）")
    ap.add_argument("--seed", type=int, default=1, help="旋律の変化（数字を変えると別のフレーズになる）")
    ap.add_argument("--out", type=Path)
    a = ap.parse_args()

    if a.bpm:
        bpm = a.bpm
        bars = max(1, round(a.seconds / (4 * 60 / bpm)))
    else:
        # 尺が小節でちょうど割り切れて、テンポが 76〜96 に入る組み合わせを選ぶ
        best = min(
            ((b, 60 * 4 * b / a.seconds) for b in range(2, 40)),
            key=lambda x: abs(x[1] - 86) if 76 <= x[1] <= 96 else 1e9,
        )
        bars, bpm = best
    mix, beats, downbeats = compose(a.style, bpm, bars, a.seed)
    out = a.out or ROOT / "materials" / f"bgm_{a.style}.wav"
    out.parent.mkdir(parents=True, exist_ok=True)
    write_wav(out, mix)
    # swing: 裏拍（8分の2つ目）が拍の何割の位置にあるか。sync_cuts.py が裏拍にカットを置くときに使う
    meta = {"file": out.name, "bpm": round(bpm, 3), "bars": bars, "swing": 0.62 if a.style == "lofi_jazz" else 0.5, "seconds": round(len(mix[0]) / SR, 3), "beats": beats, "downbeats": downbeats}
    out.with_suffix(".beats.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{out.name}: {bpm:.2f} BPM / {bars}小節 / {meta['seconds']}秒（拍の間隔 {60 / bpm:.3f}秒）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
