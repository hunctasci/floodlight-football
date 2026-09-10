import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

/** Meme text with punch-in. Deterministic in frame. */
export const MemeText: React.FC<{ text: string; startFrame?: number; durationInFrames?: number; frame?: number }> = ({
  text,
  startFrame = 0,
  durationInFrames = 60,
  frame: frameProp,
}) => {
  const hookFrame = useCurrentFrame();
  const frame = frameProp ?? hookFrame;
  const local = frame - startFrame;
  if (local < 0 || local >= durationInFrames) return null;
  const scale = interpolate(local, [0, 5], [1.6, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 420, display: 'flex', justifyContent: 'center', padding: '0 50px' }}>
      <div style={{ fontFamily: "Impact, 'Arial Black', sans-serif", fontSize: 62, fontWeight: 900, color: '#fff', WebkitTextStroke: '2px #000', textShadow: '0 5px 0 #000', textAlign: 'center', transform: `scale(${scale})`, lineHeight: 1.08 }}>
        {text}
      </div>
    </div>
  );
};
