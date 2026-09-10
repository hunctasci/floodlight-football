import type { AudioCueSpec } from '../reel/types';
import { getAudioCue } from './registry';

export interface CompiledAudioCue extends AudioCueSpec {
  bus: string;
  procedural: boolean;
  file?: string;
  startSecond: number;
  durationSeconds?: number;
}

/** Compile semantic shot cues into timed mix events. Pure. */
export function compileCues(cues: AudioCueSpec[] | undefined, fps: number): CompiledAudioCue[] {
  if (!cues) return [];
  return cues.map((c) => {
    const def = getAudioCue(c.cue);
    return {
      ...c,
      bus: def.bus,
      procedural: def.procedural,
      file: def.file,
      startSecond: c.startFrame / fps,
      durationSeconds: c.durationInFrames !== undefined ? c.durationInFrames / fps : undefined,
      volume: c.volume ?? 1,
    };
  });
}
