import type {FontKey, Plan, Position, Telop, Theme} from './types';

export const W = 1080;
export const H = 1920;

export const DEFAULT_THEME: Required<Theme> = {
  font: 'rounded',
  headFont: 'dela',
  color: '#FFFFFF',
  accent: '#FFD23F',
  outline: '#1A1A1A',
  grade: 'food',
};

export const resolveTheme = (plan: Plan): Required<Theme> => ({...DEFAULT_THEME, ...(plan.theme ?? {})});

// インスタのUI（上のタブ、右のボタン、下のキャプション）を避けた縦位置
export const POSITION_Y: Record<Position, number> = {
  top: 0.17,
  upper: 0.3,
  center: 0.5,
  lower: 0.64,
  bottom: 0.72,
};

const HEAD_TYPES = new Set(['hook', 'onomatopoeia', 'price']);

export const telopFont = (t: Telop, theme: Required<Theme>): FontKey =>
  t.font ?? (HEAD_TYPES.has(t.type) ? theme.headFont : theme.font);

export const telopAnchor = (t: Telop) => ({
  x: (t.x ?? 0.5) * W,
  y: (t.y ?? POSITION_Y[t.position ?? 'center']) * H,
});
