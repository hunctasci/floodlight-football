import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import type { Timeline } from '../engine/timeline/types';
import { duckGain } from './mix';
import { getCue } from './registry';

/**
 * Remotion audio: file cues (CC0 stadium recordings) as positioned <Audio>,
 * beds looped over their span with short fades, `hush` ducks on the bed
 * buses; every synthesised cue arrives pre-mixed in the `sfx` stem
 * (scripts/render.ts renders it offline, deterministically).
 */
export const AudioTrack: React.FC<{ tl: Timeline; sfx?: string }> = ({ tl, sfx }) => {
  const files = tl.sounds.filter((s) => getCue(s.cue).source === 'file');
  return (
    <>
      {sfx ? (
        <Sequence from={0} durationInFrames={tl.totalFrames} name="sfx-stem">
          <Audio src={staticFile(sfx)} volume={0.85} />
        </Sequence>
      ) : null}
      {files.map((s, i) => {
        const def = getCue(s.cue);
        const span = s.duration ?? tl.totalFrames - s.frame;
        const dur = Math.max(1, Math.min(span, tl.totalFrames - s.frame));
        const base = Math.min(1, Math.max(0, s.volume));
        const fadeIn = s.duration !== undefined ? 8 : 0;
        const fadeOut = s.duration !== undefined ? 10 : 0;
        return (
          <Sequence key={`${s.cue}-${i}`} from={s.frame} durationInFrames={dur} name={`sound:${s.cue}`}>
            <Audio
              src={staticFile(def.file!)}
              loop={!!def.bed && s.duration !== undefined}
              volume={(f) => {
                const env = Math.min(1, fadeIn ? f / fadeIn : 1, fadeOut ? (dur - f) / fadeOut : 1);
                const duck = def.bus === 'foreground' ? 1 : duckGain(tl, s.frame + f);
                return base * Math.max(0, env) * duck;
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
};
