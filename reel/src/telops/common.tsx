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

import {EMOJI_FONT} from '../fonts';

const segmenter = new Intl.Segmenter('ja', {granularity: 'grapheme'});

// 1文字ずつに分ける（❤️ や 👍🏻 のような絵文字も1文字として扱う）
export const chars = (s: string) => Array.from(segmenter.segment(s), (x) => x.segment);

export const isEmoji = (g: string) => /\p{Extended_Pictographic}/u.test(g);

// 絵文字にはフチや影をつけず、カラー絵文字フォントで表示する
export const emojiStyle: React.CSSProperties = {
  fontFamily: EMOJI_FONT,
  WebkitTextStroke: '0px transparent',
  textShadow: 'none',
  filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))',
};

// 全角=1、半角=0.6 として文字幅を見積もり、画面の横幅（maxW）に収まる文字サイズにする
export const textUnits = (s: string) =>
  chars(s.replace(/\*\*/g, '')).reduce(
    (sum, ch) => sum + (isEmoji(ch) || (ch.codePointAt(0) ?? 0) > 0x2e80 ? 1 : 0.6),
    0,
  );

// **強調** を accent 色に、絵文字をカラー絵文字にして表示する
export const Rich: React.FC<{text: string; accent: string; emphasis?: React.CSSProperties}> = ({text, accent, emphasis}) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
      const strong = /^\*\*[^*]+\*\*$/.test(part);
      const body = strong ? part.slice(2, -2) : part;
      const runs: Array<{emoji: boolean; s: string}> = [];
      for (const g of chars(body)) {
        const e = isEmoji(g);
        const last = runs[runs.length - 1];
        if (last && last.emoji === e) last.s += g;
        else runs.push({emoji: e, s: g});
      }
      return (
        <span key={i} style={strong ? {color: accent, ...emphasis} : undefined}>
          {runs.map((r, j) => (
            <span key={j} style={r.emoji ? emojiStyle : undefined}>
              {r.s}
            </span>
          ))}
        </span>
      );
    })}
  </>
);

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
