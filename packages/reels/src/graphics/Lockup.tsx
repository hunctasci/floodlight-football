import React from 'react';
import { Img, interpolate, spring, staticFile } from 'remotion';
import { getAsset } from '../assets/registry';
import { useLayout } from '../render/layout';
import { HNC_UI } from './hnc-ui';

/**
 * Small HNC League lockup — the badge beside a two-tone wordmark, with an
 * optional line under it. For endings where the story, not a brand card,
 * is the payoff: it settles in quietly and holds.
 */
export const Lockup: React.FC<{ frame: number; fps: number; at: number; line?: string; place?: string; tone?: 'light' | 'dark'; plate?: boolean }> = ({ frame, fps, at, line, place = 'bottom', tone = 'light', plate }) => {
  const { height, safe } = useLayout();
  const since = frame - at;
  if (since < 0) return null;
  const k = spring({ frame: since, fps, config: { damping: 20, stiffness: 120 } });
  const lineIn = interpolate(since, [fps * 0.35, fps * 0.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ink = tone === 'light' ? HNC_UI.cream : HNC_UI.navy;
  const top = place === 'top' ? safe.top + 10 : place === 'center' ? height * 0.44 : height - safe.bottom - 150;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, k * 1.5), transform: `translateY(${(1 - k) * 24}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, ...(plate ? { background: 'rgba(8,16,30,0.86)', padding: '14px 34px 14px 20px', borderRadius: 70, boxShadow: '0 10px 40px #0008' } : {}) }}>
        <Img src={staticFile(`assets/${getAsset('hnc-logo').file}`)} style={{ width: 96, height: 96, filter: 'drop-shadow(0 6px 14px #0008)' }} />
        <div style={{ fontFamily: HNC_UI.display, fontSize: 64, letterSpacing: '0.02em', color: ink, textShadow: tone === 'light' ? '3px 3px 0 #101b31' : 'none' }}>
          HNC <span style={{ color: HNC_UI.gold }}>LEAGUE</span>
        </div>
      </div>
      {line ? <div style={{ marginTop: 14, fontFamily: HNC_UI.mono, fontWeight: 800, fontSize: 26, letterSpacing: '0.2em', color: ink, opacity: lineIn * 0.9 }}>{line}</div> : null}
    </div>
  );
};
