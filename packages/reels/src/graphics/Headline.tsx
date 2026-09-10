import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

/** Large hook headline, safe-zoned for 1080x1920 (clear of top/bottom UI). */
export const Headline: React.FC<{ text: string; preset?: string; frame?: number }> = ({ text, preset = 'impact', frame: frameProp }) => {
  const hookFrame = useCurrentFrame();
  const frame = frameProp ?? hookFrame;
  const scale = interpolate(frame, [0, 10], [0.85, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 10], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 220, display: 'flex', justifyContent: 'center', padding: '0 48px' }}>
      <div
        style={{
          fontFamily: "Impact, 'Arial Black', sans-serif",
          fontWeight: 900,
          fontSize: preset === 'sports' ? 66 : 78,
          lineHeight: 1.05,
          textAlign: 'center',
          color: preset === 'sports' ? '#fff' : '#fff',
          backgroundColor: preset === 'sports' ? '#101b31' : 'transparent',
          padding: preset === 'sports' ? '14px 26px' : 0,
          borderLeft: preset === 'sports' ? '10px solid #f8cc54' : 'none',
          WebkitTextStroke: preset === 'sports' ? undefined : '2px #000',
          textShadow: '0 5px 0 #000, 0 12px 32px rgba(0,0,0,0.55)',
          transform: `scale(${scale}) translateY(${y}px)`,
          maxWidth: 980,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const Subheadline: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', justifyContent: 'center', padding: '0 80px' }}>
    <div style={{ fontSize: 40, fontWeight: 700, color: '#f8efdb', backgroundColor: 'rgba(16,27,49,0.85)', padding: '10px 26px', borderRadius: 10, textAlign: 'center', letterSpacing: 1 }}>
      {text}
    </div>
  </div>
);
