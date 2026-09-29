import React from 'react';
import { Img, interpolate, spring, staticFile } from 'remotion';
import { getAsset } from '../assets/registry';
import { useLayout } from '../render/layout';

/**
 * Phone push notification (native-looking card, the real HNC badge as the
 * app icon) dropping in from the top. Its rect is the phone world's
 * `notification` surface, so a zoom-through can dive into it.
 */
export const Notification: React.FC<{ frame: number; fps: number; at: number; end: number; app: string; title: string; body: string }> = ({ frame, fps, at, end, app, title, body }) => {
  const { height } = useLayout();
  const since = frame - at;
  if (since < 0) return null;
  const s = spring({ frame: since, fps, config: { damping: 15, stiffness: 190, mass: 0.8 } });
  const out = interpolate(frame, [end - 6, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logo = staticFile(`assets/${getAsset('hnc-logo').file}`);
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: Math.round(height * 0.085),
        height: 190,
        borderRadius: 42,
        background: 'rgba(242,242,247,0.94)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        padding: '0 32px',
        transform: `translateY(${(1 - s) * -300 - out * 300}px)`,
        fontFamily: '-apple-system, system-ui, sans-serif',
      }}
    >
      <Img src={logo} style={{ width: 104, height: 104, borderRadius: 24, background: '#101b31' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, color: '#6b6b70', letterSpacing: '0.02em' }}>
          <span>{app.toUpperCase()}</span>
          <span>now</span>
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#111', marginTop: 4 }}>{title}</div>
        <div style={{ fontSize: 34, color: '#222', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{body}</div>
      </div>
    </div>
  );
};
