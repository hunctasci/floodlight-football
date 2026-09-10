import React from 'react';
import { useCurrentFrame } from 'remotion';
import { randomRange } from '../utils/rng';
import { screenShakeOffset } from './presets';

/** Deterministic screen shake wrapper (translates children). */
export const ScreenShake: React.FC<{ children: React.ReactNode; intensity?: number; seed?: number; frame?: number }> = ({
  children,
  intensity = 0.6,
  seed = 42,
  frame: frameProp,
}) => {
  const hookFrame = useCurrentFrame();
  const frame = frameProp ?? hookFrame;
  const { x, y } = screenShakeOffset(frame, intensity, seed);
  return <div style={{ transform: `translate(${x * 60}px, ${y * 60}px)`, width: '100%', height: '100%' }}>{children}</div>;
};

export const FreezeFrame: React.FC<{ children: React.ReactNode; holdFrame?: number }> = ({ children }) => (
  <div style={{ width: '100%', height: '100%' }}>{children}</div>
);

export const SpeedLines: React.FC<{ intensity?: number; seed?: number; frame?: number }> = ({ intensity = 0.7, seed = 7, frame: frameProp }) => {
  const hookFrame = useCurrentFrame();
  const frame = frameProp ?? hookFrame;
  const lines = Array.from({ length: 14 }).map((_, i) => {
    const angle = randomRange(seed, `speed-angle-${i}`, 0, Math.PI * 2);
    const len = randomRange(seed, `speed-len-${i}`, 200, 700);
    const wobble = Math.sin(frame * 0.6 + i) * 20;
    return { angle, len, wobble };
  });
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0, opacity: intensity }}>
      {lines.map((l, i) => (
        <line
          key={i}
          x1={540 + Math.cos(l.angle) * 260}
          y1={960 + Math.sin(l.angle) * 260 + l.wobble}
          x2={540 + Math.cos(l.angle) * (260 + l.len)}
          y2={960 + Math.sin(l.angle) * (260 + l.len) + l.wobble}
          stroke="#fff"
          strokeWidth={8}
          strokeLinecap="round"
          opacity={0.7}
        />
      ))}
    </svg>
  );
};

export const Confetti: React.FC<{ seed?: number; count?: number; frame?: number }> = ({ seed = 99, count = 60, frame: frameProp }) => {
  const hookFrame = useCurrentFrame();
  const frame = frameProp ?? hookFrame;
  const pieces = Array.from({ length: count }).map((_, i) => {
    const x = randomRange(seed, `conf-x-${i}`, 0, 1080);
    const fall = (frame * (4 + (i % 5)) + randomRange(seed, `conf-y-${i}`, 0, 1920)) % 2100;
    const color = ['#f8cc54', '#e30a17', '#5fcddd', '#fff', '#7ee08a'][i % 5];
    return { x, y: fall - 100, color, r: (i * 37) % 180 };
  });
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
      {pieces.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={18} height={26} fill={p.color} transform={`rotate(${p.r + frame * 3} ${p.x} ${p.y})`} />
      ))}
    </svg>
  );
};

export const Vignette: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />
);

export const ImpactFlash: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{ position: 'absolute', inset: 0, backgroundColor: '#fff', opacity: Math.max(0, 1 - progress * 4) * 0.85 }} />
);
