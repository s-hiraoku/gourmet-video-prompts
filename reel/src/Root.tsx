import React from 'react';
import {Composition} from 'remotion';
import {FPS, Reel, totalSeconds} from './Reel';
import {H, W} from './theme';
import type {Plan} from './types';

const EMPTY: Plan = {clips: []};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    width={W}
    height={H}
    fps={FPS}
    durationInFrames={FPS * 15}
    defaultProps={EMPTY}
    calculateMetadata={({props}) => {
      const fps = props.fps ?? FPS;
      return {fps, durationInFrames: Math.max(1, Math.round(totalSeconds(props) * fps))};
    }}
  />
);
