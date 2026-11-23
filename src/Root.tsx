import React from 'react';
import {Composition} from 'remotion';
import {GamerSetup, Props, SLIDE_FRAMES} from './Video';

const defaultProps: Props = {
  slides: [
    {text: 'Tu cuarto gamer soñado', image: ''},
    {text: 'Luces RGB detrás del monitor', image: ''},
    {text: 'Sígueme para más setups', image: ''},
  ],
  music: null,
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="GamerSetup"
    component={GamerSetup}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={SLIDE_FRAMES * 3}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({
      durationInFrames: Math.max(1, props.slides.length) * SLIDE_FRAMES,
    })}
  />
);
