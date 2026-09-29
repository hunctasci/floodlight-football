import React from 'react';
import type { SceneProps } from '../../render/worlds';
import { useLayout } from '../../render/layout';
import { HNC_UI } from '../../graphics/hnc-ui';

/**
 * title — HNC-branded plate: the game's menu backdrop over a slow-drifting
 * pitch-line motif (night), a pitch-green variant, or a gold variant.
 */
export const TitleScene: React.FC<SceneProps> = ({ shot, frame, fps }) => {
  const { width, height } = useLayout();
  const theme = String(shot.set.theme ?? 'night');
  // Plain plates: the white of walking into the light, true black, Republic red.
  if (theme === 'white' || theme === 'black' || theme === 'red') {
    const bg = theme === 'white' ? 'radial-gradient(ellipse at 50% 45%, #ffffff 0%, #f7f4ec 55%, #ece6d8 100%)' : theme === 'red' ? 'radial-gradient(ellipse at 50% 40%, #e8141f 0%, #c40b16 60%, #8f0710 100%)' : '#000000';
    return <div style={{ position: 'absolute', inset: 0, background: bg }} />;
  }
  const t = frame / fps;
  const base = theme === 'pitch' ? '#1f5a33' : theme === 'gold' ? '#b98a1c' : '#0b1d27';
  const line = theme === 'gold' ? 'rgba(16,27,49,0.25)' : 'rgba(248,239,219,0.09)';
  const drift = (t * 18) % 160;
  return (
    <div style={{ position: 'absolute', inset: 0, background: base, overflow: 'hidden' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: Math.ceil(height / 160) + 2 }, (_, i) => (
          <rect key={i} x={0} y={i * 160 - drift} width={width} height={80} fill={theme === 'pitch' ? 'rgba(255,255,255,0.035)' : 'transparent'} />
        ))}
        <circle cx={width / 2} cy={height * 0.5} r={width * 0.34} fill="none" stroke={line} strokeWidth={10} />
        <line x1={0} y1={height * 0.5} x2={width} y2={height * 0.5} stroke={line} strokeWidth={10} />
        <rect x={width * 0.18} y={-10} width={width * 0.64} height={height * 0.16} fill="none" stroke={line} strokeWidth={10} />
        <rect x={width * 0.18} y={height * 0.84 + 10} width={width * 0.64} height={height * 0.16} fill="none" stroke={line} strokeWidth={10} />
      </svg>
      {theme !== 'gold' ? <div style={{ position: 'absolute', inset: 0, background: HNC_UI.menuBackdrop, opacity: 0.55 }} /> : null}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(0,0,0,0.45) 100%)' }} />
    </div>
  );
};
