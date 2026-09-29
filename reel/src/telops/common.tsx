import React from 'react';
import {interpolate, spring} from 'remotion';

export type TelopCtx = {
  f: number; // テロップ開始からのフレーム
  len: number; // 表示フレーム数
  fps: number;
  font: string;
  weight: number;
  color: string;
  accent: string;
  outline: string;
  size: number;
};

export const chars = (s: string) => Array.from(s);

// 全角=1、半角=0.6 として文字幅を見積もり、画面の横幅（maxW）に収まる文字サイズにする
export const textUnits = (s: string) =>
  Array.from(s).reduce((sum, ch) => sum + ((ch.codePointAt(0) ?? 0) > 0x2e80 ? 1 : 0.6), 0);

export const fitPx = (base: number, text: string, maxW = 940, extra = 1.1) => {
  const widest = Math.max(...text.split('\n').map(textUnits), 1);
  return Math.min(base, maxW / (widest * extra));
};
export const lines = (s: string) => s.split('\n');

// 最後の数フレームでふわっと消える
export const exitStyle = (c: TelopCtx, frames = 6): {opacity: number; transform: string} => {
  const k = interpolate(c.f, [c.len - frames, c.len], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return {opacity: k, transform: `scale(${0.9 + 0.1 * k})`};
};

export const pop = (c: TelopCtx, delay = 0, damping = 11) =>
  spring({frame: c.f - delay, fps: c.fps, config: {damping, stiffness: 180, mass: 0.8}});

// フチ取り文字（外側に太いフチ＋影）
export const strokeText = (
  color: string,
  outline: string,
  px: number,
  strokeRatio = 0.16,
): React.CSSProperties => ({
  color,
  WebkitTextStroke: `${px * strokeRatio}px ${outline}`,
  paintOrder: 'stroke fill',
  textShadow: `0 ${px * 0.06}px ${px * 0.12}px rgba(0,0,0,0.45)`,
});

export const Centered: React.FC<{x: number; y: number; rotate?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({
  x,
  y,
  rotate = 0,
  style,
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      whiteSpace: 'pre',
      ...style,
    }}
  >
    {children}
  </div>
);
