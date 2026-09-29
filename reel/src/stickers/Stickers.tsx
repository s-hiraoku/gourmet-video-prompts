import React from 'react';
import {interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {H, W} from '../theme';
import type {Sticker} from '../types';

type Ctx = {f: number; len: number; fps: number; x: number; y: number; size: number; color: string};

const fadeOut = (c: Ctx, frames = 6) =>
  interpolate(c.f, [c.len - frames, c.len], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const Star: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="-10 -10 20 20" style={{overflow: 'visible'}}>
    <path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10Z" fill={color} />
  </svg>
);

// キラキラ（料理のツヤ・新鮮さ）
const Sparkle: React.FC<{c: Ctx; seed: string}> = ({c, seed}) => {
  const n = 5;
  return (
    <>
      {Array.from({length: n}).map((_, i) => {
        const ang = random(`${seed}a${i}`) * Math.PI * 2;
        const dist = (60 + random(`${seed}d${i}`) * 140) * c.size;
        const period = 18 + random(`${seed}p${i}`) * 14;
        const phase = random(`${seed}o${i}`) * period;
        const tw = Math.max(0, Math.sin(((c.f + phase) / period) * Math.PI * 2));
        const s = (40 + random(`${seed}s${i}`) * 50) * c.size * tw;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x + Math.cos(ang) * dist - s / 2,
              top: c.y + Math.sin(ang) * dist - s / 2,
              transform: `rotate(${c.f * 3}deg)`,
              filter: `drop-shadow(0 0 ${8 * c.size}px ${c.color})`,
              opacity: fadeOut(c),
            }}
          >
            <Star size={s} color={c.color} />
          </div>
        );
      })}
    </>
  );
};

// 湯気（できたて感）
const Steam: React.FC<{c: Ctx; seed: string}> = ({c, seed}) => {
  const n = 3;
  const w = 260 * c.size;
  const h = 420 * c.size;
  return (
    <svg
      width={w}
      height={h}
      style={{position: 'absolute', left: c.x - w / 2, top: c.y - h, overflow: 'visible', filter: `blur(${5 * c.size}px)`}}
    >
      {Array.from({length: n}).map((_, i) => {
        const period = 50 + random(`${seed}${i}`) * 20;
        const t = ((c.f + i * (period / n)) % period) / period;
        const x0 = w * (0.25 + 0.25 * i);
        const rise = t * h * 0.5;
        const sway = Math.sin((c.f / 12) + i * 2) * 18 * c.size;
        const d = `M ${x0} ${h - rise} C ${x0 - 40 + sway} ${h * 0.7 - rise}, ${x0 + 40 + sway} ${h * 0.5 - rise}, ${x0 + sway} ${h * 0.3 - rise}`;
        const op = Math.sin(t * Math.PI) * 0.75 * fadeOut(c);
        return <path key={i} d={d} stroke={c.color} strokeWidth={22 * c.size} strokeLinecap="round" fill="none" opacity={op} />;
      })}
    </svg>
  );
};

// 手書き風の丸で囲む
const Circle: React.FC<{c: Ctx}> = ({c}) => {
  const rx = 230 * c.size;
  const ry = 170 * c.size;
  const draw = interpolate(c.f, [0, 12], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  const len = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) * 1.15;
  const d = `M ${-rx * 0.9} ${-ry * 0.35} C ${-rx * 0.8} ${-ry * 1.15}, ${rx * 1.1} ${-ry * 1.1}, ${rx} ${0} C ${rx * 0.95} ${ry * 1.1}, ${-rx * 1.05} ${ry * 1.05}, ${-rx} ${0} C ${-rx * 1.02} ${-ry * 0.6}, ${-rx * 0.5} ${-ry * 0.95}, ${-rx * 0.1} ${-ry * 1.05}`;
  return (
    <svg style={{position: 'absolute', left: c.x, top: c.y, overflow: 'visible', opacity: fadeOut(c)}} width={1} height={1}>
      <path
        d={d}
        fill="none"
        stroke={c.color}
        strokeWidth={14 * c.size}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - draw)}
        style={{filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))'}}
      />
    </svg>
  );
};

// 矢印（ここ見て）
const Arrow: React.FC<{c: Ctx; rotate: number}> = ({c, rotate}) => {
  const s = spring({frame: c.f, fps: c.fps, config: {damping: 12}});
  const bob = Math.sin(c.f / 4) * 14 * c.size;
  const L = 200 * c.size;
  return (
    <div
      style={{
        position: 'absolute',
        left: c.x,
        top: c.y,
        transform: `rotate(${rotate}deg) translateX(${-L - 30 * c.size + bob}px) scale(${s})`,
        transformOrigin: '0 0',
        opacity: fadeOut(c),
      }}
    >
      <svg width={L} height={L * 0.5} viewBox="0 0 200 100" style={{overflow: 'visible', transform: 'translateY(-50%)'}}>
        <path d="M 5 70 Q 80 10 170 50" fill="none" stroke={c.color} strokeWidth="16" strokeLinecap="round" />
        <path d="M 140 22 L 185 55 L 135 78" fill="none" stroke={c.color} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// 漫画の集中線（インパクトの瞬間）
const SpeedLines: React.FC<{c: Ctx}> = ({c}) => {
  const n = 64;
  const step = Math.floor(c.f / 2);
  const inner = 330 * c.size;
  const outer = Math.hypot(W, H);
  const intro = interpolate(c.f, [0, 4], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, opacity: 0.85 * intro * fadeOut(c)}}>
      {Array.from({length: n}).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + random(`sl${i}-${step}`) * 0.08;
        const r0 = inner * (0.9 + random(`r${i}-${step}`) * 0.5);
        const wdt = 0.012 + random(`w${i}-${step}`) * 0.02;
        const p1 = [c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0];
        const p2 = [c.x + Math.cos(a - wdt) * outer, c.y + Math.sin(a - wdt) * outer];
        const p3 = [c.x + Math.cos(a + wdt) * outer, c.y + Math.sin(a + wdt) * outer];
        return <polygon key={i} points={`${p1} ${p2} ${p3}`} fill={c.color} />;
      })}
    </svg>
  );
};

const Heart: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.9 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill={color} />
  </svg>
);

// ハートがふわっと上がる（おいしい！の瞬間）
const Hearts: React.FC<{c: Ctx; seed: string}> = ({c, seed}) => (
  <>
    {Array.from({length: 6}).map((_, i) => {
      const delay = i * 5;
      const t = Math.max(0, c.f - delay) / c.fps;
      const rise = t * 260 * c.size;
      const sx = (random(`${seed}x${i}`) - 0.5) * 220 * c.size + Math.sin(t * 5 + i) * 25;
      const s = (50 + random(`${seed}s${i}`) * 40) * c.size;
      const op = interpolate(t, [0, 0.15, 1.2], [0, 1, 0], {extrapolateRight: 'clamp'}) * fadeOut(c);
      return (
        <div key={i} style={{position: 'absolute', left: c.x + sx - s / 2, top: c.y - rise - s / 2, opacity: op}}>
          <Heart size={s} color={c.color} />
        </div>
      );
    })}
  </>
);

const DEFAULT_COLOR: Record<Sticker['type'], string> = {
  sparkle: '#FFF6C8',
  steam: '#FFFFFF',
  circle: '#FF4D4D',
  arrow: '#FFFFFF',
  speedlines: '#FFFFFF',
  hearts: '#FF6B8B',
};

export const StickerView: React.FC<{s: Sticker}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const c: Ctx = {
    f,
    len: durationInFrames,
    fps,
    x: s.x * W,
    y: s.y * H,
    size: s.size ?? 1,
    color: s.color ?? DEFAULT_COLOR[s.type],
  };
  const seed = `${s.type}-${s.start}-${s.x}-${s.y}`;
  switch (s.type) {
    case 'sparkle':
      return <Sparkle c={c} seed={seed} />;
    case 'steam':
      return <Steam c={c} seed={seed} />;
    case 'circle':
      return <Circle c={c} />;
    case 'arrow':
      return <Arrow c={c} rotate={s.rotate ?? 0} />;
    case 'speedlines':
      return <SpeedLines c={c} />;
    case 'hearts':
      return <Hearts c={c} seed={seed} />;
    default:
      return null;
  }
};
