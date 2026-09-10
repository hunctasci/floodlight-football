import React from 'react';
import { useCurrentFrame } from 'remotion';
import { transitionCoverage } from './registry';
import { CloudPuff } from './cloud-puff';

/**
 * Semantic transition overlay. The caller passes type+timing;
 * coverage math lives in the registry, rendering lives here.
 */
export const Transition: React.FC<{
  type: string;
  startFrame: number;
  durationInFrames: number;
  intensity?: number;
  seed?: number;
  /** Absolute global frame (Sequences shift useCurrentFrame). */
  frame?: number;
}> = ({ type, startFrame, durationInFrames, intensity = 1, seed = 42, frame: frameProp }) => {
  const hookFrame = useCurrentFrame();
  const frame = frameProp ?? hookFrame;
  const local = frame - startFrame;
  if (local < 0 || local >= durationInFrames) return null;
  if (type === 'cut') return null;
  const coverage = transitionCoverage(type, local, durationInFrames);
  if (type === 'cloud-puff') {
    return <CloudPuff progress={coverage} seed={seed} />;
  }
  if (type === 'fade') {
    return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000', opacity: Math.sin(coverage * Math.PI) }} />;
  }
  if (type === 'flash') {
    return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#fff', opacity: Math.sin(coverage * Math.PI) * intensity }} />;
  }
  if (type === 'zoom') {
    return (
      <div style={{ position: 'absolute', inset: -60, border: `${Math.round(coverage * 90 * intensity)}px solid #000`, opacity: 0.9 }} />
    );
  }
  if (type === 'whip-pan') {
    const x = (coverage - 0.5) * 2 * 1080 * intensity;
    return <div style={{ position: 'absolute', top: 0, bottom: 0, left: -200, width: 400, backgroundColor: 'rgba(255,255,255,0.85)', transform: `translateX(${540 + x}px) skewX(-12deg)` }} />;
  }
  if (type === 'glitch') {
    const n = Math.round(coverage * 8);
    return (
      <div style={{ position: 'absolute', inset: 0, opacity: 0.7 * intensity }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: (i * 240) % 1920, height: 40 + (i % 3) * 30, backgroundColor: i % 2 ? '#0ff' : '#f0f', opacity: 0.35, mixBlendMode: 'screen' }} />
        ))}
      </div>
    );
  }
  // pixelate fallback: chunky overlay grid fading with coverage
  return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#101b31', opacity: coverage * 0.55 * intensity }} />;
};
