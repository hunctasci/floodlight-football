/**
 * Director: ContentSpec → Timeline. Pure and deterministic.
 *
 * Owns every translation from story intent to frames: beat layout (no rounding
 * drift), world clocks (chained by default), scene staging that persists
 * across beats (a cast member keeps their mark and current action until told
 * otherwise, so loops continue across cuts), transitions (windows, overlap,
 * default sounds), world ambience beds, graphics/text/sound timing.
 */
import { frameAtMomentTime, type TimeRampId } from '../../animation/time-ramp';
import { normalizeCamera } from '../../camera/intent';
import { countryColors, countryName } from '../../cast/countries';
import { resolveCastSpec } from '../../cast/people';
import { getCue } from '../../audio/registry';
import { getTransition } from '../../transitions/registry';
import { getWorld } from '../../worlds/registry';
import { FORMATS, type FormatId } from '../formats';
import type { ActionStep, ActorDirection, BeatSpec, ContentSpec, GraphicSpec, SceneSpec, SoundSpec } from '../spec/types';
import { resolveAt, secondsToFrames, type BeatWindow, type TimingContext } from '../spec/timing';
import type { ActionKey, ActorTrack, CastMember, OverlayEvent, Shot, SoundEvent, Timeline } from '../timeline/types';

export interface CompileOptions {
  format?: FormatId;
}

interface BeatSlot {
  scene: SceneSpec;
  sceneIndex: number;
  beat: BeatSpec;
  window: BeatWindow;
  clock?: { from: number; to: number; ramp?: string };
}

interface Staged {
  mark: string;
  keys: ActionKey[];
  hold?: string;
  look?: string;
}

const steps = (d: ActorDirection): ActionStep[] => {
  if (d.do === undefined) return [];
  const list = Array.isArray(d.do) ? d.do : [d.do];
  return list.map((s) => (typeof s === 'string' ? { do: s } : s));
};

/** Resolve every time prop of a graphic (`at`, `*At`) to an absolute frame. */
function resolveProps(props: Record<string, unknown> | undefined, ctx: TimingContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    out[k] = (k === 'at' || /At$/.test(k)) && (typeof v === 'string' || typeof v === 'number') ? resolveAt(v, ctx) : v;
  }
  return out;
}

export function compileContent(spec: ContentSpec, opts: CompileOptions = {}): Timeline {
  const fps = spec.fps ?? 30;
  const seed = spec.seed ?? 42;
  const format = opts.format ?? spec.formats?.[0] ?? 'reel';
  const { width, height } = FORMATS[format];

  const cast: Record<string, CastMember> = {};
  for (const [id, raw] of Object.entries(spec.cast)) {
    const c = resolveCastSpec(raw);
    cast[id] = { id, country: c.country, number: c.number, name: c.name ?? countryName(c.country), accent: c.accent ?? countryColors(c.country).primary, look: c.look ?? '' };
  }

  // 1. Beat layout: frames from cumulative seconds (no drift), world clocks.
  const slots: BeatSlot[] = [];
  const windows = new Map<string, BeatWindow>();
  let seconds = 0;
  spec.scenes.forEach((scene, sceneIndex) => {
    const world = getWorld(scene.world);
    const set = scene.set ?? {};
    let clockAt = typeof set.from === 'number' ? set.from : 0;
    for (const beat of scene.beats) {
      const start = secondsToFrames(seconds, fps);
      seconds += beat.duration;
      const window = { id: beat.id, start, duration: secondsToFrames(seconds, fps) - start };
      let clock: BeatSlot['clock'];
      if (world.clockLength) {
        const from = beat.clock?.from ?? clockAt;
        // Round chained clocks so 9.9 + 1.8 is 11.7, not 11.700000000000001.
        const to = beat.clock?.to ?? Math.round((from + beat.duration) * 1e6) / 1e6;
        clock = { from, to, ramp: beat.clock?.ramp };
        clockAt = to;
      }
      windows.set(beat.id, window);
      slots.push({ scene, sceneIndex, beat, window, clock });
    }
  });
  const totalFrames = secondsToFrames(seconds, fps);

  const sceneMomentFrame = (sceneIndex: number) => (t: number): number | undefined => {
    const inScene = slots.filter((s) => s.sceneIndex === sceneIndex && s.clock);
    const hit = inScene.find((s, i) => t >= s.clock!.from && (t < s.clock!.to || (i === inScene.length - 1 && t === s.clock!.to)));
    if (!hit) return undefined;
    const length = getWorld(hit.scene.world).clockLength!(hit.scene.set ?? {});
    const c = { ...hit.clock!, length, ramp: hit.clock!.ramp as TimeRampId | undefined };
    return hit.window.start + frameAtMomentTime(c, t, hit.window.duration);
  };
  const ctxFor = (slot: BeatSlot): TimingContext => ({
    fps,
    beat: slot.window,
    beats: windows,
    momentFrame: sceneMomentFrame(slot.sceneIndex),
    momentBeats: getWorld(slot.scene.world).momentBeats?.(slot.scene.set ?? {}),
  });

  // 2. Shots with persistent scene staging.
  const shots: Shot[] = [];
  const overlays: OverlayEvent[] = [];
  const sounds: SoundEvent[] = [];
  const addSound = (s: SoundSpec | string, ctx: TimingContext): void => {
    const sp = typeof s === 'string' ? { cue: s } : s;
    const def = getCue(sp.cue);
    sounds.push({ cue: sp.cue, frame: resolveAt(sp.at, ctx), duration: sp.duration !== undefined ? secondsToFrames(sp.duration, fps) : undefined, volume: sp.volume ?? 1 });
    void def;
  };
  let staging = new Map<string, Staged>();
  let lastScene = -1;

  slots.forEach((slot) => {
    const { scene, beat, window } = slot;
    const world = getWorld(scene.world);
    const ctx = ctxFor(slot);
    if (slot.sceneIndex !== lastScene) {
      staging = new Map();
      lastScene = slot.sceneIndex;
    }
    const shotId = `${scene.id}/${beat.id}`;

    // Looks: beat > scene > cast default > world default.
    const looks: Record<string, string> = {};
    for (const [id, c] of Object.entries(cast)) {
      looks[id] = beat.cast?.[id]?.look ?? scene.looks?.[id] ?? staging.get(id)?.look ?? (c.look || world.defaultLook || 'kit');
    }

    // Staging: marks + action keys carried across the scene's beats.
    const moves = new Map<string, ActorTrack['move']>();
    for (const [id, dir] of Object.entries(beat.cast ?? {})) {
      const prev = staging.get(id);
      const mark = dir.at ?? prev?.mark;
      if (!mark) throw new Error(`${shotId}: cast "${id}" needs a mark (at: ...) the first time they appear in scene "${scene.id}"`);
      const st: Staged = prev && prev.mark === mark ? { ...prev, keys: [...prev.keys] } : { mark, keys: [] };
      const list = steps(dir);
      if (list.length === 0 && st.keys.length === 0) list.push({ do: 'idle' });
      for (const step of list) st.keys.push({ frame: resolveAt(step.at, ctx), action: step.do, lookAt: step.lookAt ?? dir.lookAt });
      if (list.length === 0 && dir.lookAt && st.keys.length) {
        const last = st.keys[st.keys.length - 1];
        st.keys.push({ frame: window.start, action: last.action, lookAt: dir.lookAt, origin: last.origin ?? last.frame });
      }
      st.keys.sort((a, b) => a.frame - b.frame);
      if (dir.hold !== undefined) st.hold = dir.hold || undefined;
      if (dir.look) st.look = dir.look;
      if (dir.move) {
        const from = world.marks[mark];
        const to = world.marks[dir.move.to];
        if (!from || !to) throw new Error(`${shotId}: move for "${id}" needs known marks`);
        const start = resolveAt(dir.move.at, ctx);
        const dist = Math.hypot(to.x - from.x, to.z - from.z);
        const end = start + secondsToFrames(dir.move.duration ?? Math.max(0.5, dist / 1.5), fps);
        moves.set(id, { to: dir.move.to, start, end });
      }
      staging.set(id, st);
    }
    const actors: ActorTrack[] = [...staging.entries()].map(([id, st]) => ({ cast: id, mark: st.mark, look: looks[id], keys: st.keys, move: moves.get(id), hold: st.hold }));
    for (const [id, mv] of moves) staging.set(id, { ...staging.get(id)!, mark: mv!.to });

    const shot: Shot = {
      id: shotId,
      scene: scene.id,
      beat: beat.id,
      purpose: beat.purpose,
      world: scene.world,
      set: scene.set ?? {},
      start: window.start,
      duration: window.duration,
      camera: normalizeCamera(beat.camera),
      actors,
      looks,
      clock: slot.clock,
      fx: (beat.fx ?? []).map((e) => ({
        type: e.type,
        start: resolveAt(e.at, ctx),
        end: resolveAt(e.until, ctx, 'end'),
        intensity: e.intensity ?? 1,
        ...(e.on ? { on: e.on } : {}),
        ...(e.props ? { props: Object.fromEntries(Object.entries(e.props).map(([k, v]) => [k, k.endsWith('At') && (typeof v === 'number' || typeof v === 'string') ? resolveAt(v, ctx) : v])) } : {}),
      })),
      freeze: beat.freeze !== undefined ? resolveAt(beat.freeze, ctx) : undefined,
    };

    // Transition in (beat.enter, or scene.enter on a scene's first beat).
    const enter = beat.enter ?? (scene.beats[0] === beat ? scene.enter : undefined);
    const prevShot = shots[shots.length - 1];
    if (enter && prevShot && enter.type !== 'cut') {
      const def = getTransition(enter.type);
      const d = secondsToFrames(enter.duration ?? def.duration, fps);
      const start = window.start - Math.round(d * def.lead);
      const ev = { type: enter.type, cut: window.start, start, end: start + d, from: enter.from, to: enter.to, direction: enter.direction, overlap: def.overlap };
      if (ev.start < prevShot.start || ev.end > shot.start + shot.duration) throw new Error(`${shotId}: ${enter.type} (${d} frames) does not fit between the neighbouring beats`);
      shot.enter = ev;
      prevShot.exit = ev;
      for (const s of def.sounds) sounds.push({ cue: s.cue, frame: s.at === 'cut' ? ev.cut : ev.start, volume: s.volume ?? 1 });
    }
    shots.push(shot);

    // Beat overlays ride on their shot layer (they move with it through a
    // zoom-through); one that lasts into later beats becomes a global overlay.
    const beatEnd = window.start + window.duration;
    const bind = (ev: OverlayEvent): OverlayEvent => (ev.end > beatEnd ? { ...ev, shot: undefined } : ev);
    for (const [i, t] of (beat.text ?? []).entries()) {
      overlays.push(bind({ id: `${shotId}/text-${i}`, kind: 'text', type: t.style ?? 'caption', start: resolveAt(t.at, ctx), end: resolveAt(t.until, ctx, 'end'), text: t.say, place: t.place, words: t.words, shot: shotId, props: {} }));
    }
    for (const [i, g] of (beat.graphics ?? []).entries()) overlays.push(bind(graphicEvent(g, `${shotId}/g-${i}`, ctx, ctx, shotId)));
    for (const s of beat.sound ?? []) addSound(s, ctx);
  });

  // 3. Scene-level graphics, sound and ambience.
  spec.scenes.forEach((scene, sceneIndex) => {
    const inScene = slots.filter((s) => s.sceneIndex === sceneIndex);
    const first = inScene[0];
    const last = inScene[inScene.length - 1];
    const byBeat = (id: string | undefined, fallback: BeatSlot): BeatSlot => {
      if (!id) return fallback;
      const s = inScene.find((x) => x.beat.id === id);
      if (!s) throw new Error(`scene "${scene.id}": unknown beat "${id}"`);
      return s;
    };
    for (const [i, g] of (scene.graphics ?? []).entries()) {
      overlays.push(graphicEvent(g, `${scene.id}/g-${i}`, ctxFor(byBeat(g.from, first)), ctxFor(byBeat(g.to, last))));
    }
    for (const s of scene.sound ?? []) addSound(s, ctxFor(first));
    const bed = getWorld(scene.world).ambience;
    if (bed && scene.ambience !== false) {
      const start = first.window.start;
      sounds.push({ cue: bed, frame: start, duration: last.window.start + last.window.duration - start, volume: 1 });
    }
  });

  const markers: Record<string, number> = {};
  for (const s of slots) {
    markers[s.beat.id] = s.window.start;
    markers[`${s.scene.id}/${s.beat.id}`] = s.window.start;
  }
  for (const [name, at] of Object.entries(spec.keyArt ?? {})) markers[`key:${name}`] = resolveAt(at, ctxFor(slots[0]));

  sounds.sort((a, b) => a.frame - b.frame || a.cue.localeCompare(b.cue));
  return { id: spec.id, title: spec.title, fps, seed, format, width, height, totalFrames, cast, shots, overlays, sounds, markers };
}

function graphicEvent(g: GraphicSpec, id: string, startCtx: TimingContext, endCtx: TimingContext, shot?: string): OverlayEvent {
  return {
    id,
    kind: 'graphic',
    type: g.kind,
    start: resolveAt(g.at, startCtx),
    end: resolveAt(g.until, endCtx, 'end'),
    text: g.text,
    shot,
    props: resolveProps(g.props, startCtx),
  };
}
