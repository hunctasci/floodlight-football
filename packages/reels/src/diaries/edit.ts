/**
 * HNC Player Diaries — the cut as data. The same edit.json drives the Blender
 * shot builders (tools/blender/py/hnc_blender/diaries), the mixer
 * (tools/diaries/py/mix.py) and this Remotion edit, so picture, sound and
 * captions can never drift apart.
 */
import ep01 from './ep01/edit.json';
import ep01Dialogue from './ep01/dialogue.json';

export type Renderer = 'blender' | 'remotion' | 'hybrid';

export interface DiaryShot {
  id: string;
  scene: string;
  dur: number;
  renderer: Renderer;
  location: string;
  framing: string;
  action: string;
  dialogue?: { line: string; at: number }[];
  sfx?: { cue: string; at: number; gain?: number; dur?: number }[];
}

export interface DiaryEdit {
  episode: string;
  title: string;
  fps: number;
  shots: DiaryShot[];
}

export interface TimedShot extends DiaryShot {
  from: number;
  frames: number;
}

export const EPISODES: Record<string, { edit: DiaryEdit; dialogue: { lines: { id: string; speaker: string; text: string }[] } }> = {
  ep01: { edit: ep01 as unknown as DiaryEdit, dialogue: ep01Dialogue },
};

/** Shot start frames exactly as the mixer computes them (round per shot, then accumulate). */
export function timeline(edit: DiaryEdit): { shots: TimedShot[]; total: number } {
  let from = 0;
  const shots = edit.shots.map((s) => {
    const frames = Math.max(1, Math.round(s.dur * edit.fps));
    const t = { ...s, from, frames };
    from += frames;
    return t;
  });
  return { shots, total: from };
}

export type Quality = 'animatic' | 'preview' | 'final';
