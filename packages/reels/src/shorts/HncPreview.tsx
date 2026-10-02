import React from 'react';
import { AbsoluteFill, staticFile } from 'remotion';
import { HncCta, HncHook } from './HncEntry';
import type { HncVariant } from './hncTheme';

/**
 * Design-exploration preview: entry/outro variants over real footage.
 * Used for stills only (variant selection), never in a shipped composition.
 */
export const HncPreview: React.FC<{ part?: 'hook' | 'cta'; variant?: HncVariant }> = ({ part = 'hook', variant = 'ticket' }) => (
  <AbsoluteFill style={{ background: '#0a0f1e' }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={staticFile(part === 'hook' ? 'generated/shorts/group-chat-croatia-england-v2/plates-v2/01-hook.png' : 'generated/shorts/group-chat-croatia-england-v2/plates-v2/06-final-message.png')}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
    {part === 'cta' ? <div style={{ position: 'absolute', inset: 0, background: '#0a0f1e99' }} /> : null}
    {part === 'hook' ? <HncHook variant={variant} /> : <HncCta variant={variant} />}
  </AbsoluteFill>
);

export const hncPreviewMetadata = () => ({ durationInFrames: 90, fps: 60, width: 1080, height: 1920 });
