import type { ShortSpec } from './spec';

/**
 * System smoke test only — NOT a story. 3.5 s at 60 fps:
 * hook (1.5 s) + placeholder (1.0 s) + CTA (1.0 s). Tests hook, Qwen voice,
 * captions, CTA and audio assembly. No Croatia/England characters.
 */
export const SYSTEM_SMOKE: ShortSpec = {
  schema: 'hnc-short/1',
  id: 'system-smoke',
  title: 'System smoke',
  fps: 60,
  width: 1080,
  height: 1920,
  hook: {
    headline: 'PICK YOUR SIDE',
    subline: 'BEFORE THE CHAT OPENS ↓',
    duration: 1.5,
    voice: {
      voiceId: 'HNC-NARRATOR-01',
      text: 'Pick your side before the group chat opens.',
      delivery: 'fast, playful, confident',
      at: 0.08,
    },
  },
  scenes: [
    {
      id: 'placeholder',
      duration: 1.0,
      visual: { kind: 'color', color: '#101b31' },
    },
  ],
  cta: {
    headline: 'HNCLEAGUE.COM',
    duration: 1.0,
    showUrl: false,
  },
};
