/**
 * Timing grammar. One place owns every "when" in a ContentSpec:
 *
 *   0.4 / '0.4'          seconds from the beat start
 *   '60%'                fraction of the beat
 *   'end' / 'end-0.3'    relative to the beat end (also 'start+0.2')
 *   '3f' / 'end-3f'      frames instead of seconds
 *   'shot.end-3f'        another beat (by id): '<beat>[.start|.end|@NN%][±n[f]]'
 *   'moment:contact'     a world-clock beat (football choreography), '±n' ok
 *   'moment:6.1'         a raw world-clock time
 *
 * Everything resolves to an absolute frame; the rest of the engine never does
 * frame arithmetic by hand.
 */
import type { At } from './types';

export class TimingError extends Error {}

export interface BeatWindow {
  id: string;
  start: number;
  duration: number;
}

export interface TimingContext {
  fps: number;
  /** The beat `At` values are relative to by default. */
  beat: BeatWindow;
  /** Beats addressable by id. */
  beats: ReadonlyMap<string, BeatWindow>;
  /** Absolute frame of a world-clock time (undefined = not covered). */
  momentFrame?: (time: number) => number | undefined;
  /** Named world-clock beats (football: contact, netHit, touch-1...). */
  momentBeats?: Readonly<Record<string, number>>;
}

const RESERVED = new Set(['start', 'end']);

function offsetFrames(raw: string | undefined, fps: number): number {
  if (!raw) return 0;
  const m = /^([+-])\s*(\d+(?:\.\d+)?)(f?)$/.exec(raw.trim());
  if (!m) throw new TimingError(`Bad time offset "${raw}"`);
  const n = Number(m[2]);
  const frames = m[3] === 'f' ? n : n * fps;
  return Math.round(m[1] === '-' ? -frames : frames);
}

function anchorFrame(w: BeatWindow, edge: string | undefined, pct: string | undefined): number {
  if (pct !== undefined) return w.start + Math.round((Number(pct) / 100) * w.duration);
  if (edge === 'end') return w.start + w.duration;
  return w.start;
}

function splitOffset(s: string): [string, string | undefined][] {
  const out: [string, string | undefined][] = [[s, undefined]];
  const m = /([+-]\s*\d+(?:\.\d+)?f?)$/.exec(s);
  if (m && m.index > 0) out.push([s.slice(0, m.index), m[1]]);
  return out;
}

/** Resolve an At to an absolute frame. */
export function resolveAt(at: At | undefined, ctx: TimingContext, fallback: 'start' | 'end' = 'start'): number {
  const { fps, beat } = ctx;
  if (at === undefined) return fallback === 'end' ? beat.start + beat.duration : beat.start;
  if (typeof at === 'number') return beat.start + Math.round(at * fps);
  const s = at.trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return beat.start + Math.round(Number(s) * fps);
  let m = /^(-?\d+(?:\.\d+)?)f$/.exec(s);
  if (m) return beat.start + Math.round(Number(m[1]));
  m = /^(\d+(?:\.\d+)?)%$/.exec(s);
  if (m) return anchorFrame(beat, undefined, m[1]);
  // Ids may contain dashes ('touch-1', 'side-eye'), so try the whole token as
  // a name before splitting a trailing '±n' offset off it.
  if (s.startsWith('moment:')) {
    for (const [name, off] of splitOffset(s.slice(7))) {
      const t = /^\d+(\.\d+)?$/.test(name) ? Number(name) : ctx.momentBeats?.[name];
      if (t === undefined) continue;
      const f = ctx.momentFrame?.(t);
      if (f === undefined) throw new TimingError(`Moment time ${t}s ("${s}") is not covered by any beat clock`);
      return f + offsetFrames(off, fps);
    }
    throw new TimingError(`Unknown moment beat in "${s}" (known: ${Object.keys(ctx.momentBeats ?? {}).join(', ') || 'none'})`);
  }
  for (const [head, off] of splitOffset(s)) {
    const r = /^(.+?)(?:\.(start|end))?(?:@(\d+(?:\.\d+)?)%)?$/.exec(head);
    if (!r) continue;
    const [, ref, edge, pct] = r;
    if (RESERVED.has(ref)) return anchorFrame(beat, ref, pct) + offsetFrames(off, fps);
    const w = ctx.beats.get(ref);
    if (w) return anchorFrame(w, edge, pct) + offsetFrames(off, fps);
  }
  throw new TimingError(`Unparseable time "${s}"`);
}

/** Seconds → frames (durations). */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}
