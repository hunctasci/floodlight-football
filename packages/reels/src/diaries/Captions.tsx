import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { HNC_BRAND } from '../graphics/branding';
import type { TimedShot } from './edit';
import { DIARY_TYPE } from './type';

/**
 * Burned-in captions (part of the master since v3). HNC people have no mouth,
 * so the caption carries who is speaking: a small name tag on spoken lines,
 * the off-camera interviewer untagged and muted, and #9's diary voice-over
 * set apart as italic thought (no tag, higher in the frame).
 * Bottom-safe for the Reels/TikTok UI (≥ 380 px clear at the bottom, 140 px
 * at the right).
 */
const TAGS: Record<string, { label: string; color: string }> = {
  NINE: { label: '🇹🇷 #9', color: HNC_BRAND.colors.red },
  FOUR: { label: '🇧🇪 #4', color: '#c99a06' },
  CHILD: { label: 'KID', color: '#e0a526' },
  PARTNER: { label: 'PARTNER', color: '#7fae86' },
  ELDER: { label: 'REGULAR', color: '#b9a37a' },
};
// The radio is background noise the off-click cuts; it is never captioned (same rule as the mixer's .srt).
const SILENT = new Set(['RADIO']);

interface Cue {
  a: number;
  b: number;
  speaker: string;
  text: string;
}

export function captionCues(shots: TimedShot[], fps: number, lines: Map<string, { speaker: string; text: string }>, seconds: Record<string, { seconds: number }>): Cue[] {
  const cues: Cue[] = [];
  for (const s of shots) {
    for (const d of s.dialogue ?? []) {
      const l = lines.get(d.line);
      if (!l || SILENT.has(l.speaker)) continue;
      const a = s.from / fps + d.at + 0.04;
      // takes carry ~0.16 s of room tone at the tail; hold short lines long enough to read
      cues.push({ a, b: a + Math.max(0.75, (seconds[d.line]?.seconds ?? 1.2) - 0.1), speaker: l.speaker, text: l.text });
    }
  }
  return cues.sort((x, y) => x.a - y.a);
}

export const Captions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cue = [...cues].reverse().find((c) => t >= c.a && t < c.b);
  if (!cue) return null;
  const fade = Math.min(interpolate(t, [cue.a, cue.a + 0.08], [0, 1], { extrapolateRight: 'clamp' }), interpolate(t, [cue.b - 0.08, cue.b], [1, 0], { extrapolateLeft: 'clamp' }));
  const vo = cue.speaker === 'NINE_VO';
  const tag = TAGS[cue.speaker];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 90, right: 140, bottom: vo ? 560 : 420, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: fade }}>
        {tag ? (
          <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: '#fff', background: tag.color, padding: '2px 14px', borderRadius: 6, marginBottom: 10 }}>{tag.label}</div>
        ) : null}
        {vo ? (
          // a translucent backing too: the VO also plays over bright frames (the tunnel blooming to white)
          <span style={{ fontFamily: DIARY_TYPE.text, fontStyle: 'italic', fontWeight: 500, fontSize: 50, lineHeight: 1.4, color: '#fffdf6', textAlign: 'center', background: '#0009', padding: '6px 18px', borderRadius: 10, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{cue.text}</span>
        ) : (
          <span
            style={{
              fontFamily: DIARY_TYPE.text,
              fontWeight: cue.speaker === 'INT' ? 500 : 650,
              fontSize: 46,
              lineHeight: 1.36,
              textAlign: 'center',
              color: cue.speaker === 'INT' ? '#d9d6ce' : '#ffffff',
              background: '#000b',
              padding: '8px 18px',
              borderRadius: 10,
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
            }}
          >
            {cue.text}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};
