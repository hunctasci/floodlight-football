/**
 * ContentSpec validation: vocabulary (with did-you-mean), cast identity,
 * timing (by compiling), and creative lint (hook, pacing, readability,
 * brand). Errors block rendering; warnings are direction notes.
 */
import { HNC_HELD_PROPS } from '@floodlight/hnc-visuals';
import { ACTIONS } from '../../cast/actions';
import { isValidCountryCode } from '../../cast/countries';
import { LOOKS } from '../../cast/looks';
import { PEOPLE, resolveCastSpec } from '../../cast/people';
import { CUES } from '../../audio/registry';
import { GENERIC_LENSES, LENS_SUBJECTS } from '../../camera/lenses';
import { normalizeCamera } from '../../camera/intent';
import { isMoveId, parseMove } from '../../camera/moves';
import { EFFECTS } from '../../effects/registry';
import { GRAPHICS, TEXT_STYLES } from '../../graphics/registry';
import { TRANSITIONS } from '../../transitions/registry';
import { WORLDS } from '../../worlds/registry';
import { footballRoles } from '../../worlds/football/football.world';
import { MOMENT_ROLES, sampleFootballMoment } from '../../worlds/football/choreography';
import { isTimeRampId } from '../../animation/time-ramp';
import type { CameraIntent } from '../timeline/types';
import type { ContentSpec, SceneSpec } from '../spec/types';
import { compileContent } from './compile';

export interface Issue {
  level: 'error' | 'warn';
  path: string;
  message: string;
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function unknown(kind: string, value: string, known: readonly string[]): string {
  const best = [...known].sort((x, y) => distance(value, x) - distance(value, y))[0];
  const hint = best !== undefined && distance(value, best) <= Math.max(2, Math.floor(value.length / 3)) ? ` — did you mean "${best}"?` : '';
  return `unknown ${kind} "${value}"${hint}`;
}

/** Subjects addressable in a scene (cast on stage, world props/lights/surfaces). */
function sceneSubjects(scene: SceneSpec): string[] {
  const w = WORLDS[scene.world];
  if (!w) return [];
  const out = [...Object.keys(w.props), ...Object.keys(w.lights), ...Object.keys(w.surfaces), ...(w.kind === '3d' ? ['camera'] : [])];
  if (scene.world === 'football') {
    const moment = String(scene.set?.moment ?? 'hero-attack');
    out.push('ball', ...(MOMENT_ROLES[moment] ?? []), ...Object.values(footballRoles(scene.set ?? {})));
  } else {
    for (const b of scene.beats) out.push(...Object.keys(b.cast ?? {}));
  }
  const actors = out.filter((id) => scene.world === 'football' || scene.beats.some((b) => b.cast?.[id]));
  for (const id of actors) out.push(`${id}.badge`, `${id}.hands`, `${id}.feet`);
  return [...new Set(out)];
}

export function validateContent(spec: ContentSpec): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warn = (path: string, message: string) => issues.push({ level: 'warn', path, message });

  if (!spec.id || !/^[a-z0-9-]+$/.test(spec.id)) err('id', 'id must be kebab-case');
  if (spec.fps !== undefined && spec.fps !== 30 && spec.fps !== 60) err('fps', 'fps must be 30 or 60');
  if (!spec.scenes?.length) err('scenes', 'at least one scene');

  for (const [id, raw] of Object.entries(spec.cast ?? {})) {
    if (raw.person && !PEOPLE[raw.person]) {
      err(`cast.${id}.person`, unknown('person', raw.person, Object.keys(PEOPLE)));
      continue;
    }
    const c = resolveCastSpec(raw);
    if (raw.person && (raw.country || raw.number)) warn(`cast.${id}`, `person "${raw.person}" owns country/number; the spec values are ignored`);
    if (raw.person) continue;
    if (!isValidCountryCode(c.country)) err(`cast.${id}.country`, `unknown country "${c.country}"`);
    if (!Number.isInteger(c.number) || c.number < 1 || c.number > 99) err(`cast.${id}.number`, 'number must be 1..99');
    if (c.look && !LOOKS[c.look]) err(`cast.${id}.look`, unknown('look', c.look, Object.keys(LOOKS)));
  }

  const beatIds = new Set<string>();
  let total = 0;
  spec.scenes?.forEach((scene, si) => {
    const sp = `scenes[${si}:${scene.id}]`;
    const world = WORLDS[scene.world];
    if (!world) {
      err(`${sp}.world`, unknown('world', scene.world, Object.keys(WORLDS)));
      return;
    }
    for (const m of world.validateSet?.(scene.set ?? {}, Object.fromEntries(Object.entries(spec.cast).map(([k, v]) => [k, { id: k, name: k, accent: '', look: '', ...resolveCastSpec(v) }]))) ?? []) err(`${sp}.set`, m);
    if (scene.world === 'football') {
      const moment = String(scene.set?.moment ?? 'hero-attack');
      const roles = MOMENT_ROLES[moment] ?? [];
      const actors = roles.length ? sampleFootballMoment(moment, 0).actors : [];
      for (const [role, castId] of Object.entries(footballRoles(scene.set ?? {}))) {
        const want = actors[roles.indexOf(role)]?.number;
        const c = spec.cast[castId] ? resolveCastSpec(spec.cast[castId]) : undefined;
        if (c && want !== undefined && c.number !== want) warn(`${sp}.set.roles.${role}`, `"${castId}" wears #${c.number} but the ${role} role is choreographed as #${want} (celebration move follows the choreography number)`);
      }
    }
    for (const [id, look] of Object.entries(scene.looks ?? {})) {
      if (!spec.cast[id]) err(`${sp}.looks.${id}`, unknown('cast member', id, Object.keys(spec.cast)));
      if (!LOOKS[look]) err(`${sp}.looks.${id}`, unknown('look', look, Object.keys(LOOKS)));
    }
    if (scene.enter && !TRANSITIONS[scene.enter.type]) err(`${sp}.enter`, unknown('transition', scene.enter.type, Object.keys(TRANSITIONS)));
    const subjects = sceneSubjects(scene);
    const checkSubject = (path: string, id: string | undefined) => {
      if (id && !subjects.includes(id)) err(path, unknown('subject', id, subjects));
    };

    scene.beats.forEach((beat, bi) => {
      const bp = `${sp}.beats[${bi}:${beat.id}]`;
      total += beat.duration;
      if (!beat.id || !/^[A-Za-z0-9_-]+$/.test(beat.id)) err(`${bp}.id`, 'beat id must be [A-Za-z0-9_-]');
      if (beatIds.has(beat.id)) err(`${bp}.id`, `duplicate beat id "${beat.id}" (ids are global: they are time references)`);
      if (beat.id === 'start' || beat.id === 'end') err(`${bp}.id`, '"start" / "end" are reserved');
      beatIds.add(beat.id);
      if (!(beat.duration >= 0.1 && beat.duration <= 12)) err(`${bp}.duration`, 'duration must be 0.1..12 s');
      if (beat.clock?.ramp && !isTimeRampId(beat.clock.ramp)) err(`${bp}.clock.ramp`, `unknown time ramp "${beat.clock.ramp}"`);
      if (beat.clock && !world.clockLength) err(`${bp}.clock`, `world "${scene.world}" has no clock`);

      // Camera.
      if (world.kind === '3d') {
        let cam: CameraIntent | undefined;
        try {
          cam = normalizeCamera(beat.camera);
        } catch (e) {
          err(`${bp}.camera`, (e as Error).message);
        }
        const lenses = [...Object.keys(GENERIC_LENSES), ...world.lensIds];
        for (const c of cam ? [cam, ...(cam.to ? [cam.to] : [])] : []) {
          if (!lenses.includes(c.lens)) err(`${bp}.camera`, unknown(`lens for ${scene.world}`, c.lens, lenses));
          const need = LENS_SUBJECTS[c.lens];
          if (need?.on && !c.on) err(`${bp}.camera`, `lens "${c.lens}" needs a subject ("${c.lens}:<subject>")`);
          if (need?.at && !c.at) err(`${bp}.camera`, `lens "${c.lens}" needs a second subject ("${c.lens}:<a>><b>")`);
          checkSubject(`${bp}.camera`, c.on);
          checkSubject(`${bp}.camera`, c.at);
          for (const m of c.move) {
            if (!isMoveId(m)) err(`${bp}.camera`, unknown('camera move', parseMove(m).id, ['push-in', 'pull-out', 'drift-left', 'drift-right', 'orbit-left', 'orbit-right', 'rise', 'descend', 'snap-zoom', 'crash-zoom', 'handheld', 'tilt-to', 'tilt-from', 'static']));
            const { id, arg } = parseMove(m);
            if (id === 'tilt-to' || id === 'tilt-from') checkSubject(`${bp}.camera`, arg);
          }
        }
      }

      // Cast directions.
      for (const [id, dir] of Object.entries(beat.cast ?? {})) {
        const ap = `${bp}.cast.${id}`;
        if (!spec.cast[id]) err(ap, unknown('cast member', id, Object.keys(spec.cast)));
        if (world.castSubjects) warn(ap, `world "${scene.world}" drives its cast itself; directions are ignored`);
        if (dir.at && !world.marks[dir.at]) err(`${ap}.at`, unknown(`mark in ${scene.world}`, dir.at, Object.keys(world.marks)));
        if (dir.move && !world.marks[dir.move.to]) err(`${ap}.move`, unknown(`mark in ${scene.world}`, dir.move.to, Object.keys(world.marks)));
        if (dir.look && !LOOKS[dir.look]) err(`${ap}.look`, unknown('look', dir.look, Object.keys(LOOKS)));
        if (dir.hold && !(HNC_HELD_PROPS as readonly string[]).includes(dir.hold)) err(`${ap}.hold`, unknown('held prop', dir.hold, [...HNC_HELD_PROPS]));
        const list = dir.do === undefined ? [] : Array.isArray(dir.do) ? dir.do : [dir.do];
        for (const s of list) {
          const a = typeof s === 'string' ? s : s.do;
          if (!ACTIONS[a]) err(`${ap}.do`, unknown('action', a, Object.keys(ACTIONS)));
          const look = typeof s === 'string' ? undefined : s.lookAt;
          if (look && look !== id) checkSubject(`${ap}.do`, look);
        }
        if (dir.lookAt) checkSubject(`${ap}.lookAt`, dir.lookAt);
      }

      for (const [i, t] of (beat.text ?? []).entries()) {
        if (t.style && !TEXT_STYLES[t.style]) err(`${bp}.text[${i}]`, unknown('text style', t.style, Object.keys(TEXT_STYLES)));
        if (t.place?.startsWith('on:')) checkSubject(`${bp}.text[${i}].place`, t.place.slice(3));
        const words = t.say.trim().split(/\s+/).length;
        if (words / Math.max(0.3, beat.duration) > 4.5) warn(`${bp}.text[${i}]`, `${words} words in ${beat.duration}s is hard to read (≤ 4.5 words/s)`);
      }
      for (const [i, g] of (beat.graphics ?? []).entries()) {
        if (!GRAPHICS[g.kind]) err(`${bp}.graphics[${i}]`, unknown('graphic', g.kind, Object.keys(GRAPHICS)));
        const ws = GRAPHICS[g.kind]?.worlds;
        if (ws && !ws.includes(scene.world)) err(`${bp}.graphics[${i}]`, `graphic "${g.kind}" only renders in ${ws.join(', ')}`);
      }
      for (const [i, e] of (beat.fx ?? []).entries()) {
        const def = EFFECTS[e.type];
        if (!def) err(`${bp}.fx[${i}]`, unknown('effect', e.type, Object.keys(EFFECTS)));
        else if (def.layer === 'world' && !def.worlds?.includes(scene.world)) err(`${bp}.fx[${i}]`, `effect "${e.type}" only works in ${def.worlds?.join(', ')}`);
      }
      for (const [i, s] of (beat.sound ?? []).entries()) {
        const cue = typeof s === 'string' ? s : s.cue;
        if (!CUES[cue]) err(`${bp}.sound[${i}]`, unknown('sound cue', cue, Object.keys(CUES)));
      }
      if (beat.enter && !TRANSITIONS[beat.enter.type]) err(`${bp}.enter`, unknown('transition', beat.enter.type, Object.keys(TRANSITIONS)));
      const tr = beat.enter ?? (bi === 0 ? scene.enter : undefined);
      if (tr && TRANSITIONS[tr.type]) {
        const def = TRANSITIONS[tr.type];
        const prev = bi > 0 ? scene : spec.scenes[si - 1];
        if (def.to === 'light' && !tr.to) err(`${bp}.enter`, `${tr.type} needs "to": a light in this shot (${Object.keys(world.lights).join(', ') || 'none'})`);
        if (def.from && !tr.from) err(`${bp}.enter`, `${tr.type} needs "from": a ${def.from} in the previous shot`);
        if (def.to === 'light' && tr.to && !world.lights[tr.to]) err(`${bp}.enter`, unknown(`light in ${scene.world}`, tr.to, Object.keys(world.lights)));
        const prevWorld = prev ? WORLDS[prev.world] : undefined;
        if (def.from === 'light' && tr.from && prevWorld && !prevWorld.lights[tr.from]) err(`${bp}.enter`, unknown(`light in ${prev?.world}`, tr.from, Object.keys(prevWorld.lights)));
        if (def.from === 'surface' && tr.from && prevWorld) {
          const ok = prevWorld.kind === '2d' ? !!prevWorld.surfaceRect?.(tr.from, undefined as never, 0, 1920) : !!prevWorld.surfaces[tr.from];
          if (!ok) err(`${bp}.enter`, `unknown surface "${tr.from}" in ${prev?.world}`);
        }
      }
    });
    for (const [i, g] of (scene.graphics ?? []).entries()) {
      if (!GRAPHICS[g.kind]) err(`${sp}.graphics[${i}]`, unknown('graphic', g.kind, Object.keys(GRAPHICS)));
    }
    for (const [i, s] of (scene.sound ?? []).entries()) if (!CUES[s.cue]) err(`${sp}.sound[${i}]`, unknown('sound cue', s.cue, Object.keys(CUES)));
  });

  if (total > 60) err('scenes', `total ${total.toFixed(2)}s exceeds 60s`);
  if (issues.some((i) => i.level === 'error')) return issues;

  // Timing + staging: compile.
  try {
    compileContent(spec);
  } catch (e) {
    err('compile', (e as Error).message);
    return issues;
  }

  // Creative lint.
  const beats = spec.scenes.flatMap((s) => s.beats.map((b) => ({ s, b })));
  const first = beats[0]?.b;
  if (first && first.duration > 2.2) warn('scenes[0].beats[0]', 'the hook runs >2.2s before the first cut — earn attention faster');
  if (first && !first.text?.length && !(first.graphics?.length) && !spec.scenes[0].graphics?.length) warn('scenes[0].beats[0]', 'no on-screen hook text in the first beat (most viewers watch muted)');
  for (const { s, b } of beats) {
    const cam = typeof b.camera === 'string' ? b.camera : b.camera.lens + ' ' + (b.camera.move ?? []).join(' ');
    if (WORLDS[s.world]?.kind === '3d' && b.duration > 3.5 && !/push|pull|drift|orbit|rise|descend|tilt|handheld|crash/.test(cam) && !(typeof b.camera !== 'string' && b.camera.to)) {
      warn(`${s.id}/${b.id}`, `${b.duration}s static shot — add a motivated move or cut`);
    }
  }
  const lastScene = spec.scenes[spec.scenes.length - 1];
  const brandish = (g: { kind: string }) => g.kind === 'brand-reveal' || g.kind === 'lockup' || g.kind === 'notification' || g.kind === 'live-bug';
  const tail = [...(lastScene.graphics ?? []), ...lastScene.beats.slice(-2).flatMap((b) => b.graphics ?? [])];
  if (!tail.some(brandish)) warn('brand', 'no HNC brand moment (brand-reveal) in the final beats');
  if (!beats.some(({ b }) => b.purpose === 'payoff' || b.purpose === 'punchline')) warn('purpose', 'no beat marked payoff/punchline — what is the release?');
  return issues;
}

export function assertValidContent(spec: ContentSpec): void {
  const errors = validateContent(spec).filter((i) => i.level === 'error');
  if (errors.length) throw new Error(`Invalid content "${spec.id}":\n${errors.map((e) => `- ${e.path}: ${e.message}`).join('\n')}`);
}
