import React from 'react';
import { Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { compileCues } from './cues';
import type { AudioCueSpec } from '../reel/types';

/**
 * Remotion audio composition: semantic cues become timed <Sequence>+<Audio>.
 * Procedural-only cues render silence (their synth lives in the offline
 * FFmpeg mix, mirroring social-video); bundled crowd files play when present.
 * Missing files never break a render.
 */
export const AudioTrack: React.FC<{
  cues?: AudioCueSpec[];
  fps: number;
  totalFrames: number;
  music?: string;
  musicVolume?: number;
}> = ({ cues, fps, totalFrames, music, musicVolume = 0.25 }) => {
  const frame = useCurrentFrame();
  void frame;
  const compiled = compileCues(cues, fps);
  return (
    <>
      {music ? (
        <Sequence from={0} durationInFrames={totalFrames}>
          <Audio src={music} volume={musicVolume} />
        </Sequence>
      ) : null}
      {compiled.map((c, i) => {
        if (c.procedural || !c.file) return null;
        const duration = c.durationInFrames ?? totalFrames - c.startFrame;
        let src: string;
        try {
          src = staticFile(`assets/audio/${c.file}`);
        } catch {
          return null;
        }
        return (
          <Sequence key={`${c.cue}-${i}`} from={c.startFrame} durationInFrames={Math.max(1, duration)}>
            <Audio src={src} volume={Math.min(1, Math.max(0, c.volume ?? 1))} />
          </Sequence>
        );
      })}
    </>
  );
};
