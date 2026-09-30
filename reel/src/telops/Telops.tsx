import React from 'react';
import {Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily, fontWeight} from '../fonts';
import {telopAnchor, telopFont} from '../theme';
import type {Telop, Theme} from '../types';
import {Centered, Rich, TelopCtx, chars, emojiStyle, exitStyle, fitPx, isEmoji, lines, pop, strokeText, textUnits} from './common';

type Props = {t: Telop; theme: Required<Theme>};

// 冒頭のつかみ：1文字ずつ弾んで出る
const Hook: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = fitPx(128 * c.size, t.text, 960, 1.15);
  let idx = 0;
  const breathe = 1 + 0.018 * Math.sin((c.f / c.fps) * Math.PI * 2);
  return (
    <div style={{...exitStyle(c), transform: `${exitStyle(c).transform} scale(${breathe})`}}>
      {lines(t.text).map((line, li) => (
        <div key={li} style={{display: 'flex', justifyContent: 'center', lineHeight: 1.18}}>
          {chars(line).map((ch, i) => {
            const s = pop(c, idx++ * 1.6, 9);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  fontSize: px,
                  transform: `translateY(${(1 - s) * 60}px) scale(${s}) rotate(${(1 - s) * -12}deg)`,
                  ...strokeText(li === 0 ? c.accent : c.color, c.outline, px, 0.2),
                  ...(isEmoji(ch) ? emojiStyle : {}),
                }}
              >
                {ch === ' ' ? ' ' : ch}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ポンと出るふつうのテロップ
const Pop: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = fitPx(84 * c.size, t.text);
  const s = pop(c);
  const e = exitStyle(c);
  return (
    <div style={{opacity: e.opacity, transform: `${e.transform} scale(${0.6 + 0.4 * s})`}}>
      {lines(t.text).map((line, i) => (
        <div key={i} style={{fontSize: px, lineHeight: 1.25, ...strokeText(c.color, c.outline, px)}}>
          <Rich text={line} accent={c.accent} />
        </div>
      ))}
    </div>
  );
};

// 帯が伸びて文字がスライドイン
const Slide: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = fitPx(66 * c.size, t.text, 900, 1.05);
  const band = pop(c, 0, 16);
  return (
    <div style={{...exitStyle(c), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px * 0.25}}>
      {lines(t.text).map((line, i) => {
        const b = pop(c, i * 4, 16);
        const tx = pop(c, 3 + i * 4, 14);
        return (
          <div key={i} style={{position: 'relative', padding: `${px * 0.18}px ${px * 0.5}px`}}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: c.accent,
                borderRadius: px * 0.18,
                transform: `scaleX(${i === 0 ? band : b})`,
                transformOrigin: 'left center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}
            />
            <div
              style={{
                position: 'relative',
                fontSize: px,
                color: c.outline,
                opacity: tx,
                transform: `translateX(${(1 - tx) * -80}px)`,
              }}
            >
              <Rich text={line} accent={c.accent} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 蛍光ペンが引かれる
const Marker: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = fitPx(80 * c.size, t.text);
  const s = pop(c, 0, 14);
  return (
    <div style={{...exitStyle(c), opacity: exitStyle(c).opacity * Math.min(1, s * 2)}}>
      {lines(t.text).map((line, i) => {
        const draw = interpolate(c.f, [6 + i * 5, 16 + i * 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <div key={i} style={{position: 'relative', display: 'inline-block', margin: `${px * 0.08}px 0`}}>
            <div
              style={{
                position: 'absolute',
                left: -px * 0.15,
                right: -px * 0.15,
                bottom: px * 0.05,
                height: px * 0.45,
                background: c.accent,
                opacity: 0.9,
                borderRadius: px * 0.1,
                transform: `scaleX(${draw}) skewX(-8deg)`,
                transformOrigin: 'left center',
              }}
            />
            <div style={{position: 'relative', fontSize: px, lineHeight: 1.2, ...strokeText(c.color, c.outline, px, 0.14)}}>
              <Rich text={line} accent={c.accent} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 1文字ずつタイプ
const Typewriter: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = fitPx(64 * c.size, t.text, 860);
  const all = chars(t.text);
  const shown = Math.min(all.length, Math.floor(c.f / 1.6));
  const text = all.slice(0, shown).join('');
  const cursor = shown < all.length || Math.floor(c.f / 8) % 2 === 0;
  return (
    <div
      style={{
        ...exitStyle(c),
        background: 'rgba(0,0,0,0.62)',
        borderRadius: px * 0.3,
        padding: `${px * 0.35}px ${px * 0.55}px`,
        fontSize: px,
        lineHeight: 1.35,
        color: c.color,
        textAlign: 'left',
      }}
    >
      {/* 最終形の大きさを確保して、枠がガタつかないようにする */}
      <div style={{position: 'relative'}}>
        <div style={{visibility: 'hidden'}}><Rich text={t.text} accent={c.accent} /></div>
        <div style={{position: 'absolute', inset: 0}}>
          <Rich text={text} accent={c.accent} />
          <span style={{opacity: cursor ? 1 : 0, color: c.accent}}>▍</span>
        </div>
      </div>
    </div>
  );
};

// ぷるぷる揺れる強調
const Shake: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = fitPx(104 * c.size, t.text, 940, 1.2);
  const s = pop(c, 0, 8);
  const jig = Math.sin(c.f * 1.9) * 3.5;
  const pulse = 1 + 0.05 * Math.sin(c.f * 0.9);
  const e = exitStyle(c);
  return (
    <div style={{opacity: e.opacity, transform: `${e.transform} scale(${s * pulse}) rotate(${jig}deg)`}}>
      {lines(t.text).map((line, i) => (
        <div key={i} style={{fontSize: px, lineHeight: 1.2, ...strokeText(c.accent, c.outline, px, 0.2)}}>
          <Rich text={line} accent={c.accent} />
        </div>
      ))}
    </div>
  );
};

// 擬音（ジュワッ、とろ〜り）：漫画風に1文字ずつ飛び出す
const Onomatopoeia: React.FC<{t: Telop; c: TelopCtx; seed: string}> = ({t, c, seed}) => {
  const px = fitPx(150 * c.size, t.text, 940, 1.2);
  const e = exitStyle(c, 5);
  return (
    <div style={{opacity: e.opacity, transform: `${e.transform} skewX(-8deg)`}}>
      {lines(t.text).map((line, li) => (
        <div key={li} style={{display: 'flex', lineHeight: 1.05}}>
          {chars(line).map((ch, i) => {
            const s = pop(c, i * 2.2 + li * 4, 7);
            const r = (random(`${seed}-${li}-${i}`) - 0.5) * 24;
            const wob = Math.sin(c.f * 0.5 + i) * 3;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  fontSize: px * (1 - 0.06 * i),
                  transform: `scale(${s}) rotate(${r + wob}deg) translateY(${Math.sin(i * 1.3) * 12}px)`,
                  color: c.accent,
                  WebkitTextStroke: `${px * 0.16}px ${c.color}`,
                  paintOrder: 'stroke fill',
                  filter: `drop-shadow(0 0 0 ${c.outline}) drop-shadow(${px * 0.05}px ${px * 0.05}px 0 ${c.outline})`,
                  ...(isEmoji(ch) ? emojiStyle : {}),
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// 値札スタンプ
const Price: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const d = 380 * c.size;
  const s = pop(c, 0, 10);
  const scale = 1.9 - 0.9 * s;
  const e = exitStyle(c);
  const spin = (c.f / c.fps) * 20;
  return (
    <div
      style={{
        opacity: e.opacity * Math.min(1, s * 3),
        transform: `${e.transform} scale(${scale}) rotate(${-18 + 10 * s}deg)`,
        width: d,
        height: d,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: c.accent,
          boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: d * 0.05,
          borderRadius: '50%',
          border: `${d * 0.012}px dashed ${c.outline}`,
          transform: `rotate(${spin}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: c.outline,
          lineHeight: 1.05,
        }}
      >
        {lines(t.text).map((line, i) => (
          <div key={i} style={{fontSize: (d * 0.24) / Math.max(1, chars(line).length / 5), whiteSpace: 'nowrap'}}>
            <Rich text={line} accent={c.accent} />
          </div>
        ))}
        {t.sub ? <div style={{fontSize: d * 0.09, marginTop: d * 0.03}}>{t.sub}</div> : null}
      </div>
    </div>
  );
};

// 字幕テロップ：文章をそのまま読ませる。自動で折り返し（句読点が行頭に来ないよう禁則処理）、**強調** と絵文字に対応。1文字ずつふわっと出る
const Caption: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const maxW = 900;
  const text = t.text;
  // まずは1行ずつ収まる大きさまで縮める。それでも入らない長い行だけ、バランスよく折り返す
  const units = Math.max(...lines(text).map(textUnits), 1);
  const px = Math.max(42, Math.min(58 * c.size, maxW / (units * 1.08)));
  const box = pop(c, 0, 16);
  const e = exitStyle(c, 8);
  const perChar = Math.max(0.35, Math.min(1.2, 12 / Math.max(1, chars(text).length)));
  let idx = 0;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div
      style={{
        opacity: e.opacity * Math.min(1, box * 1.5),
        transform: `${e.transform} translateY(${(1 - box) * 30}px)`,
        // 親要素の幅に左右されないよう、幅は文字数から決める
        width: Math.min(maxW, units * px * 1.08) + px * 1.2,
        boxSizing: 'border-box',
        background: 'rgba(12,10,8,0.58)',
        borderRadius: px * 0.45,
        padding: `${px * 0.42}px ${px * 0.6}px`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        fontSize: px,
        lineHeight: 1.45,
        color: c.color,
        whiteSpace: 'pre-wrap',
        lineBreak: 'strict',
        textWrap: 'balance',
        textAlign: 'center',
        textShadow: '0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      {parts.map((part, pi) => {
        const strong = /^\*\*[^*]+\*\*$/.test(part);
        const body = strong ? part.slice(2, -2) : part;
        return chars(body).map((g, gi) => {
          const k = interpolate(c.f - 4 - idx++ * perChar, [0, 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <span
              key={`${pi}-${gi}`}
              style={{
                opacity: k,
                ...(strong ? {color: c.accent} : {}),
                ...(isEmoji(g) ? emojiStyle : {}),
              }}
            >
              {g}
            </span>
          );
        });
      })}
    </div>
  );
};

// 上品なメインコピー：文字がぼかしから浮かび上がり、字間がゆっくり締まる。金の細線つき。vertical で縦書き
const Title: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const vertical = !!t.vertical;
  const px = fitPx(96 * c.size, t.text, vertical ? 1000 : 920, 1.35);
  const all = chars(t.text.replace(/\n/g, ''));
  const perChar = Math.max(1, Math.min(3, 24 / Math.max(1, all.length)));
  const spacing = interpolate(c.f, [0, 45], [0.42, 0.2], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const rule = interpolate(c.f, [4, 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const e = exitStyle(c, 10);
  let idx = 0;
  const line = (key: string) => (
    <div
      key={key}
      style={{
        background: `linear-gradient(${vertical ? '180deg' : '90deg'}, transparent, ${c.accent}, transparent)`,
        ...(vertical ? {width: 2, height: px * 5, transform: `scaleY(${rule})`} : {height: 2, width: px * 6, transform: `scaleX(${rule})`}),
      }}
    />
  );
  return (
    <div
      style={{
        opacity: e.opacity,
        display: 'flex',
        flexDirection: vertical ? 'row' : 'column',
        alignItems: 'center',
        gap: px * 0.45,
      }}
    >
      {line('a')}
      <div
        style={{
          writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
          fontSize: px,
          lineHeight: 1.5,
          letterSpacing: `${spacing}em`,
          color: c.color,
          textShadow: '0 2px 18px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.4)',
          whiteSpace: 'pre',
        }}
      >
        {lines(t.text).map((l, li) => (
          <div key={li}>
            {chars(l).map((g, gi) => {
              const k = interpolate(c.f - idx++ * perChar, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
              return (
                <span key={gi} style={{opacity: k, filter: `blur(${(1 - k) * 10}px)`, ...(isEmoji(g) ? emojiStyle : {})}}>
                  {g}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {t.sub ? (
        <div
          style={{
            fontSize: px * 0.3,
            letterSpacing: '0.35em',
            color: c.accent,
            opacity: interpolate(c.f, [20, 34], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {t.sub}
        </div>
      ) : null}
      {line('b')}
    </div>
  );
};

const PinIcon: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path
      d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
      fill={color}
    />
  </svg>
);

// 店舗情報カード
const Info: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = fitPx(58 * c.size, t.text, 820, 1.3);
  const s = pop(c, 0, 15);
  const subs = t.sub ? lines(t.sub) : [];
  return (
    <div
      style={{
        ...exitStyle(c),
        opacity: exitStyle(c).opacity * s,
        transform: `${exitStyle(c).transform} translateY(${(1 - s) * 90}px)`,
        background: 'rgba(255,255,255,0.95)',
        borderRadius: px * 0.45,
        padding: `${px * 0.5}px ${px * 0.7}px`,
        minWidth: 640,
        boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
        borderLeft: `${px * 0.2}px solid ${c.accent}`,
        textAlign: 'left',
        alignItems: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: px * 0.25, fontSize: px, color: '#1E1E1E'}}>
        <PinIcon size={px * 1.05} color={c.accent === '#FFFFFF' ? '#E8453C' : c.accent} />
        <Rich text={t.text} accent={c.accent} />
      </div>
      {subs.map((line, i) => {
        const k = pop(c, 5 + i * 3, 15);
        return (
          <div
            key={i}
            style={{
              fontSize: px * 0.62,
              color: '#444',
              marginTop: px * 0.2,
              opacity: k,
              transform: `translateX(${(1 - k) * 40}px)`,
            }}
          >
            <Rich text={line} accent={c.accent} />
          </div>
        );
      })}
    </div>
  );
};

const BookmarkIcon: React.FC<{size: number; fill: number; color: string}> = ({size, fill, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <defs>
      <clipPath id="bm-fill">
        <rect x="0" y={24 * (1 - fill)} width="24" height="24" />
      </clipPath>
    </defs>
    <path d="M6 3h12v18l-6-4.5L6 21z" fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M6 3h12v18l-6-4.5L6 21z" fill={color} clipPath="url(#bm-fill)" />
  </svg>
);

// 保存してね
const Cta: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = fitPx(64 * c.size, t.text, 800, 1.1);
  const s = pop(c, 0, 10);
  const fill = interpolate(c.f, [10, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bounce = pop(c, 10, 6);
  const e = exitStyle(c);
  return (
    <div
      style={{
        opacity: e.opacity,
        transform: `${e.transform} scale(${s})`,
        display: 'flex',
        alignItems: 'center',
        gap: px * 0.3,
        background: c.accent,
        color: c.outline,
        borderRadius: 999,
        padding: `${px * 0.3}px ${px * 0.7}px`,
        fontSize: px,
        boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{transform: `scale(${0.8 + 0.2 * bounce}) rotate(${(1 - bounce) * -20}deg)`, display: 'flex'}}>
        <BookmarkIcon size={px * 1.1} fill={fill} color={c.outline} />
      </div>
      <Rich text={t.text} accent={c.accent} />
    </div>
  );
};

// 小さいタグ（PR、限定など）
const Label: React.FC<{t: Telop; c: TelopCtx}> = ({t, c}) => {
  const px = 40 * c.size;
  const s = pop(c, 0, 14);
  return (
    <div
      style={{
        ...exitStyle(c),
        opacity: exitStyle(c).opacity * s,
        background: 'rgba(0,0,0,0.6)',
        color: c.color,
        border: `2px solid ${c.color}`,
        borderRadius: px * 0.3,
        padding: `${px * 0.15}px ${px * 0.45}px`,
        fontSize: px,
        letterSpacing: '0.05em',
      }}
    >
      <Rich text={t.text} accent={c.accent} />
    </div>
  );
};

export const TelopView: React.FC<Props> = ({t, theme}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const key = telopFont(t, theme);
  const c: TelopCtx = {
    f,
    len: durationInFrames,
    fps,
    font: fontFamily(key),
    weight: fontWeight(key),
    color: t.color ?? theme.color,
    accent: t.accent ?? theme.accent,
    outline: theme.outline,
    size: t.size ?? 1,
  };
  const {x, y} = telopAnchor(t);
  const defaultRotate = t.type === 'onomatopoeia' ? -10 : t.type === 'hook' ? -3 : 0;

  const body = (() => {
    switch (t.type) {
      case 'hook':
        return <Hook t={t} c={c} />;
      case 'slide':
        return <Slide t={t} c={c} />;
      case 'marker':
        return <Marker t={t} c={c} />;
      case 'typewriter':
        return <Typewriter t={t} c={c} />;
      case 'shake':
        return <Shake t={t} c={c} />;
      case 'onomatopoeia':
        return <Onomatopoeia t={t} c={c} seed={`${t.text}-${t.start}`} />;
      case 'price':
        return <Price t={t} c={c} />;
      case 'info':
        return <Info t={t} c={c} />;
      case 'cta':
        return <Cta t={t} c={c} />;
      case 'label':
        return <Label t={t} c={c} />;
      case 'caption':
        return <Caption t={t} c={c} />;
      case 'title':
        return <Title t={t} c={c} />;
      default:
        return <Pop t={t} c={c} />;
    }
  })();

  return (
    <Centered x={x} y={y} rotate={t.rotate ?? defaultRotate} style={{fontFamily: c.font, fontWeight: c.weight}}>
      {body}
    </Centered>
  );
};
