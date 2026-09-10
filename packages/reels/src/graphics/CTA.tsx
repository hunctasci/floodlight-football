import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { HNC_BRAND } from '../football/data/branding';

export const CTA: React.FC<{ headline?: string; subline?: string; frame?: number }> = ({
  headline = HNC_BRAND.tagline,
  subline = HNC_BRAND.subline,
  frame: frameProp,
}) => {
  const hookFrame = useCurrentFrame();
  const frame = frameProp ?? hookFrame;
  const scale = interpolate(frame, [0, 12], [0.9, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '0 60px', backgroundColor: 'rgba(8,14,28,0.72)' }}>
      <div style={{ fontFamily: "Impact, 'Arial Black', sans-serif", fontSize: 110, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.02, textShadow: '0 6px 0 #000', transform: `scale(${scale})` }}>
        {headline}
      </div>
      <div style={{ fontSize: 44, fontWeight: 900, color: '#101b31', backgroundColor: '#f8cc54', padding: '14px 40px', borderRadius: 999, letterSpacing: 1 }}>
        {subline}
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color: '#f8efdb', letterSpacing: 2 }}>{HNC_BRAND.site}</div>
    </div>
  );
};
