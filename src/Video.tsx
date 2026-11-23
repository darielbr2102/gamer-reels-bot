import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type Slide = {text: string; image: string};
export type Props = {slides: Slide[]; music: string | null};

export const SLIDE_FRAMES = 90; // 3 s por slide a 30 fps
const ACCENT = '#a855f7';

const SlideView: React.FC<{slide: Slide; index: number; total: number}> = ({
  slide,
  index,
  total,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const zoom = interpolate(frame, [0, SLIDE_FRAMES], [1.05, 1.22]);
  const enter = spring({frame: frame - 6, fps, config: {damping: 14}});
  const translateY = interpolate(enter, [0, 1], [60, 0]);
  const fadeOut = interpolate(frame, [SLIDE_FRAMES - 8, SLIDE_FRAMES], [1, 0.0], {
    extrapolateLeft: 'clamp',
  });
  const isFirst = index === 0;

  return (
    <AbsoluteFill style={{backgroundColor: '#0b0b14'}}>
      {slide.image ? (
        <AbsoluteFill style={{transform: `scale(${zoom})`}}>
          <Img src={staticFile(slide.image)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{background: 'linear-gradient(160deg,#1e1b4b,#0b0b14)'}} />
      )}

      <AbsoluteFill
        style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.8) 100%)'}}
      />

      {/* Barra de progreso */}
      <div style={{position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', gap: 10}}>
        {Array.from({length: total}).map((_, i) => (
          <div key={i} style={{flex: 1, height: 8, borderRadius: 4, background: i <= index ? ACCENT : 'rgba(255,255,255,0.3)'}} />
        ))}
      </div>

      <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 70px 260px'}}>
        <div
          style={{
            transform: `translateY(${translateY}px)`,
            opacity: enter * fadeOut,
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontSize: isFirst ? 112 : 88,
            lineHeight: 1.05,
            color: '#fff',
            textTransform: 'uppercase',
            textShadow: `0 0 30px ${ACCENT}, 0 6px 18px rgba(0,0,0,0.9)`,
            textAlign: 'center',
          }}
        >
          {slide.text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const GamerSetup: React.FC<Props> = ({slides, music}) => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    {music ? <Audio src={staticFile(music)} volume={0.5} /> : null}
    <Series>
      {slides.map((slide, i) => (
        <Series.Sequence key={i} durationInFrames={SLIDE_FRAMES}>
          <SlideView slide={slide} index={i} total={slides.length} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
