import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export interface ShortCue {
  a: number;
  b: number;
  speaker: string;
  text: string;
}

/**
 * Reusable short-form captions — English by default (translated tracks later).
 * Lower-middle safe area, high contrast, max ~1–2 short lines. Source of truth
 * is the spoken line text (ShortSpec voice refs + voices.json durations), never
 * a hand-maintained copy.
 */
export function shortCues(
  lines: { id: string; at: number; speaker: string; text: string }[],
  seconds: Record<string, { seconds: number }>,
): ShortCue[] {
  return lines
    .map((l) => ({
      a: l.at + 0.04,
      b: l.at + Math.max(0.8, (seconds[l.id]?.seconds ?? 1.2) - 0.1),
      speaker: l.speaker,
      text: l.text,
    }))
    .sort((x, y) => x.a - y.a);
}

/** Split a caption into at most two balanced lines for phones. */
function twoLines(text: string): [string, string?] {
  const words = text.split(' ');
  if (words.length <= 4 || text.length <= 26) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

export const ShortCaptions: React.FC<{ cues: ShortCue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cue = [...cues].reverse().find((c) => t >= c.a && t < c.b);
  if (!cue) return null;
  const fade = Math.min(interpolate(t, [cue.a, cue.a + 0.07], [0, 1], { extrapolateRight: 'clamp' }), interpolate(t, [cue.b - 0.07, cue.b], [1, 0], { extrapolateLeft: 'clamp' }));
  const [l1, l2] = twoLines(cue.text);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 90, right: 90, bottom: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: fade }}>
        <span
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 52,
            lineHeight: 1.32,
            textAlign: 'center',
            color: '#ffffff',
            background: '#000c',
            padding: '10px 22px',
            borderRadius: 12,
          }}
        >
          {l1}
          {l2 ? (
            <>
              <br />
              {l2}
            </>
          ) : null}
        </span>
      </div>
    </AbsoluteFill>
  );
};
