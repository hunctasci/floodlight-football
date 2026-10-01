/**
 * HNC Player Diaries — the cut as data. The same edit.json drives the Blender
 * shot builders (tools/blender/py/hnc_blender/diaries), the mixer
 * (tools/diaries/py/mix.py) and this Remotion edit, so picture, sound and
 * captions can never drift apart.
 */
import type { ContentSpec } from '../engine/spec/types';
import ep01Voices from '../../public/generated/diaries/ep01/vo/voices.json';
import { EP01_CHAT_OPEN, EP01_CHAT_TEASER } from './ep01/chat';
import ep01 from './ep01/edit.json';
import ep01Dialogue from './ep01/dialogue.json';
import rivalsVoices from '../../public/generated/diaries/rivals/vo/voices.json';
import { RIVALS_CHAT_OPEN, RIVALS_CHAT_TEASER } from './rivals/chat';
import rivals from './rivals/edit.json';
import rivalsDialogue from './rivals/dialogue.json';
import type { TVScore } from './Memory';
import type { OpenerBeat } from './Opener';

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
  /** Phone shots: which of the episode's phone pieces this shot plays (Reel Factory phone world). */
  phone?: string;
  /** Frame-0 hook caption over the shot (+ its Turkish line). */
  hook?: string;
  hookTr?: string;
  /** On-screen documentary questions (v4: replace the interviewer's voice); `at`/`dur` shot-relative s. */
  cards?: { text: string; tr?: string; at: number; dur: number }[];
  /** Day · time stamp shown as the shot opens ("WEDNESDAY · 06:47"). */
  stamp?: string;
  /** A Remotion card instead of (or, for `match`, over) a plate. */
  screen?:
    | { type: 'title'; title: string; kicker: string }
    | { type: 'end'; series: string }
    | { type: 'match'; home: string; away: string; line: string }
    | { type: 'tv'; score: TVScore }
    | { type: 'opener'; beats: OpenerBeat[] };
  /** Documentary lower third the first time a speaker appears. */
  super?: { title: string; sub: string; side: 'left' | 'right'; color: string };
  /** Kinetic bilingual text over the plate (the opener). */
  kinetic?: { en: string; tr: string; sub?: string };
  /** Period look applied over the plate in the edit. */
  look?: 'archive' | 'memory';
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

export interface DiaryEpisode {
  edit: DiaryEdit;
  dialogue: { lines: { id: string; speaker: string; text: string; tr?: string }[] };
  /** Burned-in subtitle language: the English line, or its Turkish translation (`tr`). */
  subtitles?: 'en' | 'tr';
  /** Approved take lengths (seconds) — caption timing. */
  voices: Record<string, { seconds: number }>;
  phones: Record<string, ContentSpec>;
}

export const EPISODES: Record<string, DiaryEpisode> = {
  ep01: { edit: ep01 as unknown as DiaryEdit, dialogue: ep01Dialogue, voices: ep01Voices, phones: { open: EP01_CHAT_OPEN, teaser: EP01_CHAT_TEASER } },
  rivals: { subtitles: 'tr', edit: rivals as unknown as DiaryEdit, dialogue: rivalsDialogue, voices: rivalsVoices as Record<string, { seconds: number }>, phones: { open: RIVALS_CHAT_OPEN, teaser: RIVALS_CHAT_TEASER } },
};

/**
 * Frames in a shot, rounded exactly like the Python side (Blender's Shot and the mixer use
 * Python's round(): halves go to the even neighbour). Math.round sends halves up, which at
 * 30 fps (e.g. 4.75 s = 142.5 frames) put the picture a frame off the sound.
 */
export function shotFrames(dur: number, fps: number): number {
  const x = dur * fps;
  const f = Math.floor(x);
  const r = x - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(x);
  return Math.max(1, r);
}

/** Shot start frames exactly as the mixer computes them (round per shot, then accumulate). */
export function timeline(edit: DiaryEdit): { shots: TimedShot[]; total: number } {
  let from = 0;
  const shots = edit.shots.map((s) => {
    const frames = shotFrames(s.dur, edit.fps);
    const t = { ...s, from, frames };
    from += frames;
    return t;
  });
  return { shots, total: from };
}

export type Quality = 'animatic' | 'preview' | 'final' | 'release';
