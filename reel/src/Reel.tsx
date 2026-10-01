import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion';
import {TransitionSeries} from '@remotion/transitions';
import {ClipView} from './ClipView';
import {loadFonts} from './fonts';
import {StickerView} from './stickers/Stickers';
import {TelopView} from './telops/Telops';
import {resolveTheme, telopFont} from './theme';
import {DEFAULT_TRANSITION_SEC, makePresentation, timing} from './transitions';
import type {FontKey, Plan} from './types';

export const FPS = 30;

// 各クリップのつなぎ（秒）。クリップの duration はカット点からカット点までなので、
// トランジションの半分ずつ前後に伸ばして重ね、全体の長さが duration の合計と一致するようにする
export const transitionSecs = (plan: Plan) =>
  plan.clips.map((clip, i) => {
    if (i === plan.clips.length - 1 || !clip.transition || clip.transition.type === 'cut') {
      return 0;
    }
    const want = clip.transition.duration ?? DEFAULT_TRANSITION_SEC[clip.transition.type];
    const next = plan.clips[i + 1];
    return Math.min(want, clip.duration, next.duration);
  });

export const totalSeconds = (plan: Plan) => plan.clips.reduce((sum, c) => sum + c.duration, 0);

const toFrames = (sec: number, fps: number) => Math.round(sec * fps);

export const Reel: React.FC<Plan> = (props) => {
  const {fps, durationInFrames} = useVideoConfig();
  // カバー画像モード：動画のテロップ・ステッカーの代わりに cover.telops を、アニメーションが終わった状態で出す
  const coverTelops = props._cover ? props.cover?.telops : undefined;
  const plan: Plan = coverTelops
    ? {
        ...props,
        stickers: [],
        telops: coverTelops.map((t) => ({...t, start: Math.max(0, props.cover!.time - 2), end: totalSeconds(props)})),
      }
    : props;
  const theme = resolveTheme(plan);
  const trans = transitionSecs(plan);

  useMemo(() => {
    const usage = new Map<FontKey, string>();
    for (const t of plan.telops ?? []) {
      const key = telopFont(t, theme);
      usage.set(key, (usage.get(key) ?? '') + t.text + (t.sub ?? ''));
    }
    loadFonts(usage);
  }, [plan.telops, theme]);

  // カット点の位置をフレームで固定してから、各クリップの長さを決める（丸め誤差をためない）
  const cuts = [0];
  plan.clips.forEach((c) => cuts.push(cuts[cuts.length - 1] + c.duration));
  const cutFrames = cuts.map((s) => toFrames(s, fps));
  const transFrames = trans.map((s) => toFrames(s, fps));

  const series: React.ReactNode[] = [];
  plan.clips.forEach((clip, i) => {
    // 前のつなぎの半分だけ早く始め、次のつなぎの半分だけ長く映す（重なり＝つなぎの長さ）
    const pre = i > 0 ? Math.floor(transFrames[i - 1] / 2) : 0;
    const post = Math.ceil(transFrames[i] / 2);
    const len = cutFrames[i + 1] - cutFrames[i] + pre + post;
    series.push(
      <TransitionSeries.Sequence key={`c${i}`} durationInFrames={Math.max(1, len)}>
        <ClipView clip={clip} grade={clip.grade ?? theme.grade} preRoll={pre / fps} />
      </TransitionSeries.Sequence>,
    );
    if (transFrames[i] > 0) {
      const pres = makePresentation(clip.transition!.type, clip.transition!.direction ?? 'left');
      if (pres) {
        series.push(
          <TransitionSeries.Transition key={`t${i}`} presentation={pres} timing={timing(transFrames[i])} />,
        );
      }
    }
  });

  const bgmVol = plan.bgm?.volume ?? 0.35;
  const fadeFrames = Math.min(fps, Math.floor(durationInFrames / 4));

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <TransitionSeries>{series}</TransitionSeries>

      {(plan.stickers ?? []).map((s, i) => (
        <Sequence key={`s${i}`} from={toFrames(s.start, fps)} durationInFrames={Math.max(1, toFrames(s.end - s.start, fps))} layout="none">
          <AbsoluteFill>
            <StickerView s={s} />
          </AbsoluteFill>
        </Sequence>
      ))}

      {(plan.telops ?? []).map((t, i) => (
        <Sequence key={`t${i}`} from={toFrames(t.start, fps)} durationInFrames={Math.max(1, toFrames(t.end - t.start, fps))} layout="none">
          <AbsoluteFill>
            <TelopView t={t} theme={theme} />
          </AbsoluteFill>
        </Sequence>
      ))}

      {(plan.sfx ?? []).map((s, i) => (
        <Sequence key={`sfx${i}`} from={toFrames(s.at, fps)} layout="none">
          <Audio src={staticFile(`sfx/${s.type}.wav`)} volume={s.volume ?? 0.6} />
        </Sequence>
      ))}

      {plan.bgm ? (
        <Audio
          src={staticFile(`materials/${plan.bgm.file}`)}
          trimBefore={toFrames(plan.bgm.start ?? 0, fps)}
          loop
          volume={(f) =>
            bgmVol *
            interpolate(f, [0, 6, durationInFrames - fadeFrames, durationInFrames], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
