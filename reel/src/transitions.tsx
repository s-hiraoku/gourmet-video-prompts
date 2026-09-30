import React from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {linearTiming} from '@remotion/transitions';
import type {TransitionPresentation, TransitionPresentationComponentProps} from '@remotion/transitions';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {fade} from '@remotion/transitions/fade';
import {flip} from '@remotion/transitions/flip';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import type {Direction, TransitionType} from './types';
import {H, W} from './theme';

type DirProps = {direction: Direction};

// 勢いよく横に流れる「ウィップパン」
const Whip: React.FC<TransitionPresentationComponentProps<DirProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  const entering = presentationDirection === 'entering';
  const d = passedProps.direction;
  const blur = Math.sin(p * Math.PI) * 36;
  const move = entering ? (1 - p) * 100 : -p * 100;
  const horizontal = d === 'left' || d === 'right';
  const sign = d === 'left' || d === 'up' ? 1 : -1;
  return (
    <AbsoluteFill
      style={{
        transform: horizontal ? `translateX(${sign * move}%)` : `translateY(${sign * move}%)`,
        filter: `blur(${blur}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// 画面に吸い込まれるようにズームして切り替わる
const Zoom: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === 'entering';
  const scale = entering ? 1.35 - 0.35 * p : 1 + 0.6 * p;
  const blur = entering ? (1 - p) * 24 : p * 24;
  return (
    <AbsoluteFill style={{transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity: entering ? p : 1}}>
      {children}
    </AbsoluteFill>
  );
};

// 白くフラッシュして切り替わる
const Flash: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === 'entering';
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{opacity: entering ? p : 1}}>{children}</AbsoluteFill>
      {entering ? (
        <AbsoluteFill style={{backgroundColor: '#FFFFFF', opacity: 1 - Math.abs(2 * p - 1)}} />
      ) : null}
    </AbsoluteFill>
  );
};

const custom = <T extends Record<string, unknown>>(
  component: React.FC<TransitionPresentationComponentProps<T>>,
  props: T,
): TransitionPresentation<T> => ({component, props});

const toSlideDir = (d: Direction) =>
  ({left: 'from-right', right: 'from-left', up: 'from-bottom', down: 'from-top'})[d] as
    | 'from-right'
    | 'from-left'
    | 'from-bottom'
    | 'from-top';

export const makePresentation = (type: TransitionType, direction: Direction): TransitionPresentation<any> | null => {
  switch (type) {
    case 'fade':
      return fade();
    case 'slide':
      return slide({direction: toSlideDir(direction)});
    case 'wipe':
      return wipe({direction: toSlideDir(direction)});
    case 'flip':
      return flip({direction: toSlideDir(direction)});
    case 'clock_wipe':
      return clockWipe({width: W, height: H});
    case 'whip':
      return custom(Whip, {direction});
    case 'zoom':
      return custom(Zoom, {});
    case 'flash':
      return custom(Flash, {});
    default:
      return null;
  }
};

export const DEFAULT_TRANSITION_SEC: Record<TransitionType, number> = {
  cut: 0,
  fade: 0.4,
  slide: 0.35,
  wipe: 0.35,
  flip: 0.5,
  clock_wipe: 0.5,
  whip: 0.25,
  zoom: 0.3,
  flash: 0.25,
};

export const timing = (frames: number) =>
  linearTiming({durationInFrames: frames, easing: Easing.inOut(Easing.cubic)});
