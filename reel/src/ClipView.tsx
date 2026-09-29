import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Clip, Grade} from './types';

const GRADE_FILTER: Record<Grade, string> = {
  food: 'saturate(1.18) contrast(1.06) brightness(1.03)',
  warm: 'saturate(1.15) contrast(1.05) brightness(1.04) sepia(0.12)',
  fresh: 'saturate(1.12) contrast(1.04) brightness(1.07) hue-rotate(-4deg)',
  moody: 'saturate(1.05) contrast(1.16) brightness(0.9)',
  none: 'none',
};

const VIGNETTE: Partial<Record<Grade, number>> = {food: 0.28, warm: 0.3, moody: 0.5};

type Props = {
  clip: Clip;
  grade: Grade;
  preRoll: number; // 前のトランジション分、カット点より早く始める秒数
};

export const ClipView: React.FC<Props> = ({clip, grade, preRoll}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const p = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  const base = clip.zoom ?? 1;
  const fx = clip.focus?.x ?? 0.5;
  const fy = clip.focus?.y ?? 0.5;

  let scale = base;
  let tx = 0;
  let ty = 0;
  let rot = 0;
  switch (clip.motion ?? (clip.type === 'photo' ? 'slow_zoom_in' : 'none')) {
    case 'slow_zoom_in':
      scale = base * interpolate(p, [0, 1], [1, 1.09]);
      break;
    case 'slow_zoom_out':
      scale = base * interpolate(p, [0, 1], [1.09, 1]);
      break;
    case 'punch_in': {
      const s = spring({frame: frame - Math.round(preRoll * fps), fps, config: {damping: 14, stiffness: 220}});
      scale = base * (1 + 0.14 * s + 0.03 * p);
      break;
    }
    case 'pan_left':
      scale = base * 1.14;
      tx = interpolate(p, [0, 1], [4.5, -4.5]);
      break;
    case 'pan_right':
      scale = base * 1.14;
      tx = interpolate(p, [0, 1], [-4.5, 4.5]);
      break;
    case 'pan_up':
      scale = base * 1.14;
      ty = interpolate(p, [0, 1], [4.5, -4.5]);
      break;
    case 'pan_down':
      scale = base * 1.14;
      ty = interpolate(p, [0, 1], [-4.5, 4.5]);
      break;
    case 'shake': {
      const k = Math.max(0, 1 - (frame - preRoll * fps) / 12);
      scale = base * (1.06 + 0.04 * k);
      tx = Math.sin(frame * 2.7) * 1.4 * k;
      ty = Math.cos(frame * 3.1) * 1.4 * k;
      rot = Math.sin(frame * 2.1) * 1.2 * k;
      break;
    }
    default:
      break;
  }

  const mediaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${fx * 100}% ${fy * 100}%`,
    filter: GRADE_FILTER[clip.grade ?? grade],
  };
  const src = staticFile(`materials/${clip.source}`);
  const speed = clip.speed ?? 1;
  const startSec = Math.max(0, (clip.in ?? 0) - preRoll * speed);
  const vignette = VIGNETTE[clip.grade ?? grade];

  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `translate(${tx}%, ${ty}%) scale(${scale}) rotate(${rot}deg)`,
          transformOrigin: `${fx * 100}% ${fy * 100}%`,
        }}
      >
        {clip.type === 'video' ? (
          <OffthreadVideo
            src={src}
            trimBefore={Math.round((startSec * fps) / 1)}
            playbackRate={speed}
            volume={clip.volume ?? 1}
            style={mediaStyle}
          />
        ) : (
          <Img src={src} style={mediaStyle} />
        )}
      </AbsoluteFill>
      {vignette ? (
        <AbsoluteFill
          style={{background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${vignette}) 100%)`}}
        />
      ) : null}
    </AbsoluteFill>
  );
};
