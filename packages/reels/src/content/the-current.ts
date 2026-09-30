import type { BeatSpec, ContentSpec, SceneSpec } from '../engine/spec/types';

/**
 * HNC: THE CURRENT — hero creative, an original HNC football-anime short
 * (tribute to the grammar of classic football anime; nothing borrowed).
 * 9:16, 60 fps, 150 BPM grid (1 beat = 0.4 s = 24 frames), 51.2 s.
 * Storyboard + style bible: social/output/anime-tribute/.
 *
 * Renderer per shot: `plate` scenes are Blender plates (tools/blender, pose
 * tracks baked from the SAME `meridian` choreography); football scenes are the
 * canonical R3F stadium; `title` is the 2D World Table beat. The score is one
 * original synthesised cue (audio/scores) timed to this grid.
 */

const B = 0.4; // one beat
const plate = (id: string, beat: Omit<BeatSpec, 'camera'>, extra: Partial<SceneSpec> = {}): SceneSpec => ({
  id,
  world: 'plate',
  set: { plate: `current-${id}` },
  ambience: false,
  beats: [{ camera: 'wide', ...beat } as BeatSpec],
  ...extra,
});
const roles = { striker: 'hero', rival: 'rival', keeper: 'keeper' };
const night = { moment: 'meridian', roles, light: 'night', crowdLight: 'follow' };
const CRIMSON = '#ff2a3d';

export const THE_CURRENT: ContentSpec = {
  id: 'the-current',
  title: 'HNC: The Current',
  logline: 'The World Table is tied on the last night. The keeper grounds the Current and the stadium goes dark — until a nation re-charges the lines. MERIDIAN.',
  fps: 60,
  seed: 150,
  formats: ['reel'],
  cast: {
    hero: { person: 'emre' },
    rival: { person: 'nikos' },
    keeper: { person: 'petros' },
  },
  keyArt: { thumb: 'charge@70%', meridian: 'meridian@35%', legend: 'legend@60%', blackout: 'blackout@55%' },
  scenes: [
    // ── ACT 1 — INVOCATION ────────────────────────────────────────────────
    plate('eye', {
      id: 'eye',
      purpose: 'hook',
      duration: 4 * B,
      text: [{ say: 'The last night of the season.', style: 'cinema', at: 0.85, until: 'end-0.05', place: 'top' }],
      // Eyes open on beat 3: the picture punches in with a crimson flash.
      fx: [{ type: 'motes', intensity: 0.6, props: { color: 'TR' } }, { type: 'zoom-punch', at: 0.8, intensity: 0.5 }, { type: 'flash', at: 0.8, intensity: 0.3 }, { type: 'chroma', at: 0.8, intensity: 0.6 }, { type: 'vignette', intensity: 0.6 }],
      // The original score runs the whole piece (audio/score/the-current.ts, bar-mapped to this edit).
      sound: [{ cue: 'score-the-current', at: 0, volume: 0.7 }, { cue: 'sub-hit', at: 0, volume: 1.3 }, { cue: 'heartbeat', at: 0.15, volume: 1.2 }, { cue: 'zap', at: 0.8, volume: 0.9 }],
    }),
    {
      id: 'lights',
      world: 'football',
      set: night,
      ambience: false,
      beats: [
        {
          id: 'lights',
          purpose: 'setup',
          duration: 4 * B,
          clock: { from: 0.2, to: 0.8 },
          camera: 'dark-rise',
          // lights-up window 2.5 s from -0.3 s: the four banks strike on beats 1-4 (p = .12 + .16 i).
          fx: [{ type: 'lights-up', at: -0.3, until: 'end+0.6' }],
          sound: [0, 1, 2, 3].map((i) => ({ cue: 'impact', at: i * B, volume: 3.2 })),
        },
      ],
    },
    plate('chalk', {
      id: 'chalk',
      purpose: 'clue',
      duration: 4 * B,
      text: [{ say: 'Every nation has a Current.', style: 'cinema', at: 0.25, until: 'end-0.05', place: 'top' }],
      sound: [{ cue: 'charge', at: 0, duration: 0.95, volume: 0.7 }, { cue: 'zap', at: 0.95, volume: 1.2 }],
    }),
    {
      id: 'table',
      world: 'title',
      set: { theme: 'night' },
      ambience: false,
      enter: { type: 'glitch' },
      beats: [
        {
          id: 'table',
          purpose: 'reveal',
          duration: 4 * B,
          camera: 'wide',
          fx: [{ type: 'buzz-shake', at: 0, until: 0.35 }, { type: 'buzz-shake', at: 1.05, until: 1.3 }],
          graphics: [
            {
              kind: 'world-table',
              at: 0,
              props: {
                rows: [{ code: 'GR', points: 41 }, { code: 'TR', points: 41 }, { code: 'BR', points: 37 }, { code: 'DE', points: 36 }, { code: 'JP', points: 34 }],
                hero: 'hero',
                gain: 0,
                climbAt: 'end+5',
                lines: ['FINAL NIGHT.', 'TIED AT THE TOP.'],
                tag: '',
                note: 'ILLUSTRATIVE STANDINGS',
              },
            },
          ],
          sound: [{ cue: 'glitch', at: 1.05, volume: 1.1 }, { cue: 'riser-long', at: 0.2, duration: 1.4, volume: 0.8 }],
        },
      ],
    },
    {
      id: 'destiny',
      world: 'football',
      set: night,
      ambience: false,
      enter: { type: 'glitch' },
      beats: [
        {
          id: 'destiny',
          purpose: 'reveal',
          duration: 4 * B,
          clock: { from: 0.8, to: 1.2 },
          camera: 'destiny-drift',
          // Both Currents race in from the ends and meet at halfway on beat 3 (46 m / 1.2 s).
          fx: [{ type: 'current-lines', at: 0, props: { speed: 38.3 } }, { type: 'vignette', intensity: 0.8 }, { type: 'shade-top', intensity: 0.8 }],
          text: [{ say: 'Tonight the table\nis destiny.', style: 'title', at: 0.15, until: 'end-0.05', place: 'top' }],
          sound: [{ cue: 'zap', at: 0, volume: 1 }, { cue: 'shock', at: 1.2, volume: 1.4 }],
        },
      ],
    },
    // ── ACT 2 — RIVALS / THE CURRENT AWAKENS ──────────────────────────────
    plate('emre', {
      id: 'emre',
      purpose: 'reveal',
      duration: 4 * B,
      fx: [{ type: 'zoom-punch', at: 0.12, intensity: 0.4 }, { type: 'shade-bottom', intensity: 0.7 }],
      graphics: [{ kind: 'character-card', at: 0.12, until: 'end', props: { cast: 'hero', current: 'Crimson Current' } }],
      sound: [{ cue: 'slam-hit', at: 0.12, volume: 1.1 }, { cue: 'zap', at: 0.5, volume: 0.6 }],
    }),
    plate('nikos', {
      id: 'nikos',
      purpose: 'reveal',
      duration: 4 * B,
      fx: [{ type: 'zoom-punch', at: 0.12, intensity: 0.4 }, { type: 'shade-bottom', intensity: 0.7 }],
      graphics: [{ kind: 'character-card', at: 0.12, until: 'end', props: { cast: 'rival', current: 'Azure Current', side: 'right' } }],
      sound: [{ cue: 'slam-hit', at: 0.12, volume: 1.1 }, { cue: 'zap', at: 0.5, volume: 0.6 }],
    }),
    plate('petros', {
      id: 'petros',
      purpose: 'reveal',
      duration: 4 * B,
      fx: [{ type: 'zoom-punch', at: 0.1, intensity: 0.4 }, { type: 'shade-bottom', intensity: 0.7 }],
      graphics: [{ kind: 'character-card', at: 0.1, until: 'end', props: { cast: 'keeper', current: 'Grounds every Current' } }],
      sound: [{ cue: 'slam-hit', at: 0.1, volume: 1.1 }, { cue: 'power-down', at: 0.55, duration: 0.6, volume: 0.5 }],
    }),
    // ── ACT 2/3 — THE MATCH (one continuous choreography) ─────────────────
    {
      id: 'match',
      world: 'football',
      set: night,
      beats: [
        {
          id: 'faceoff',
          purpose: 'tension',
          duration: 4 * B,
          clock: { from: 0.9, to: 2.5 },
          camera: 'faceoff-depth-push',
          fx: [{ type: 'aura', on: 'hero', intensity: 0.35 }, { type: 'aura', on: 'rival', intensity: 0.35 }, { type: 'rival-grade', intensity: 0.6 }, { type: 'cinebars' }],
          graphics: [{ kind: 'versus', at: 0.2, until: 'end-0.1', props: { home: 'hero', away: 'rival' } }],
          sound: [{ cue: 'aura-hum', at: 0, duration: 1.6, volume: 0.6 }],
        },
        {
          id: 'kickoff',
          purpose: 'escalation',
          duration: 3 * B,
          clock: { from: 2.5, to: 2.9 },
          camera: 'kickoff-drop',
          fx: [{ type: 'current-lines', at: 0, intensity: 1.8, props: { speed: 48 } }],
          sound: [{ cue: 'whistle', at: 0, volume: 1.4 }, { cue: 'zap', at: 0.05, volume: 1.2 }, { cue: 'shock', at: 0.96, volume: 1.2 }],
        },
        {
          id: 'burst',
          purpose: 'escalation',
          duration: 3 * B,
          clock: { from: 2.9, to: 3.7 },
          camera: 'runner-burst',
          fx: [{ type: 'aura', on: 'hero', intensity: 0.7 }, { type: 'speed-lines', at: 0.2, intensity: 0.7 }],
        },
        {
          id: 'duel',
          purpose: 'escalation',
          duration: 3 * B,
          clock: { from: 3.7, to: 4.2 },
          camera: 'runner-lead',
          fx: [{ type: 'aura', on: 'hero', intensity: 0.7 }, { type: 'aura', on: 'rival', intensity: 0.7 }],
        },
        {
          id: 'undertow',
          purpose: 'escalation',
          duration: 3 * B,
          clock: { from: 4.2, to: 4.44 },
          camera: 'undertow-low',
          fx: [
            { type: 'aura', on: 'rival', intensity: 0.9 },
            { type: 'aura', on: 'hero', intensity: 0.6 },
            { type: 'ground-trail', on: 'rival', props: { fromMoment: 4.25, toMoment: 4.75, width: 1.6, height: 1.25, color: 'GR', fade: 2 } },
            { type: 'impact-shake', at: 'moment:slide', intensity: 0.5 },
          ],
          graphics: [{ kind: 'technique-card', at: 0.3, until: 'end', props: { name: 'Undertow', cast: 'rival', place: 'top' } }],
          sound: [{ cue: 'wave', at: 'moment:slide', volume: 1.2 }, { cue: 'slam-hit', at: 0.3, volume: 0.9 }],
        },
        {
          id: 'crescent',
          purpose: 'payoff',
          duration: 4 * B,
          clock: { from: 4.44, to: 4.76 },
          freeze: 0.7,
          camera: 'crescent-top',
          fx: [
            { type: 'aura', on: 'hero', intensity: 0.8 },
            { type: 'ground-trail', on: 'hero', props: { fromMoment: 4.1, toMoment: 4.9, width: 0.7, color: 'TR', fade: 3 } },
            { type: 'freeze-grade', at: 0.7 },
            { type: 'focus-lines', at: 0.7, on: 'hero', intensity: 0.9 },
            { type: 'zoom-punch', at: 0.7, intensity: 0.5 },
          ],
          graphics: [{ kind: 'technique-card', at: 0.72, until: 'end', props: { name: 'Crescent Cut', cast: 'hero', place: 'bottom' } }],
          sound: [{ cue: 'ting', at: 0.7, volume: 1.2 }, { cue: 'slam-hit', at: 0.72, volume: 1 }, { cue: 'hush', at: 0.7, duration: 0.9 }],
        },
        {
          id: 'longrun',
          purpose: 'escalation',
          duration: 4 * B,
          clock: { from: 4.6, to: 5.8 },
          camera: 'long-run-vertigo',
          fx: [{ type: 'aura', on: 'hero', intensity: 0.75 }, { type: 'speed-lines', intensity: 0.6 }],
          sound: [{ cue: 'whoosh', at: 0.1, volume: 1.4 }],
        },
        {
          id: 'shot1',
          purpose: 'escalation',
          duration: 3 * B,
          clock: { from: 5.8, to: 6.6, ramp: 'anticipation-snap' },
          camera: 'striker-windup',
          fx: [
            { type: 'aura', on: 'hero', intensity: 0.85 },
            { type: 'impact-burst', at: 'moment:contact' },
            { type: 'impact-shake', at: 'moment:contact', intensity: 0.8 },
            { type: 'zoom-punch', at: 'moment:contact', intensity: 0.7 },
            { type: 'plasma-trail', at: 'moment:contact+1f', props: { color: 'TR', fromMoment: 6.5 } },
          ],
          sound: [{ cue: 'crowd-gasp', at: 'moment:contact-1.85', volume: 0.7 }],
        },
        {
          id: 'pov',
          purpose: 'tension',
          duration: 1 * B,
          clock: { from: 6.6, to: 6.8 },
          camera: 'keeper-pov',
          fx: [{ type: 'plasma-trail', props: { color: 'TR', fromMoment: 6.5, length: 0.3 } }],
          sound: [{ cue: 'charge', at: 0, duration: 0.8, volume: 0.9 }],
        },
        {
          id: 'blackout',
          purpose: 'reveal',
          duration: 4 * B,
          clock: { from: 6.8, to: 7.05 },
          camera: 'blackout-front',
          fx: [
            { type: 'plasma-trail', until: 'moment:parry', props: { color: 'TR', fromMoment: 6.5, length: 0.3 } },
            { type: 'aura', on: 'keeper', at: 0, intensity: 0.8 },
            { type: 'impact-frame', at: 'moment:parry', intensity: 0.8 },
            { type: 'impact-shake', at: 'moment:parry', intensity: 0.9 },
            // The shot's Current drains into him: every bank dies.
            { type: 'lights-out', at: 'moment:parry+2f', until: 'end-0.1' },
          ],
          graphics: [{ kind: 'technique-card', at: 0.62, until: 'end', props: { name: 'Blackout', cast: 'keeper', place: 'top' } }],
          sound: [{ cue: 'keeper-save', at: 'moment:parry', volume: 2 }, { cue: 'impact', at: 'moment:parry', volume: 3 }, { cue: 'power-down', at: 'moment:parry+2f', duration: 1.2, volume: 1.4 }, { cue: 'hush', at: 'moment:parry', duration: 3.4 }],
        },
        {
          id: 'deadball',
          purpose: 'tension',
          duration: 3 * B,
          clock: { from: 7.05, to: 7.2 },
          camera: 'deadball-sky',
          // What is left of the shot's Current, dying on the ball as it rises.
          fx: [{ type: 'plasma-trail', intensity: 0.55, props: { color: 'TR', fromMoment: 6.92, length: 0.35 } }, { type: 'motes', intensity: 0.5, props: { color: 'TR' } }],
          sound: [{ cue: 'heartbeat', at: 0.1, volume: 1.2 }],
        },
        {
          id: 'react-nikos',
          purpose: 'reaction',
          duration: 2 * B,
          clock: { from: 7.2, to: 7.25 },
          camera: 'close:rival push-in',
          fx: [{ type: 'aura', on: 'rival', intensity: 0.35 }],
        },
        {
          id: 'react-emre',
          purpose: 'reaction',
          duration: 3 * B,
          clock: { from: 7.25, to: 7.3 },
          camera: 'close:hero push-in',
          // The Current isn't dead in him: a spark lights his face in the dark.
          fx: [{ type: 'aura', on: 'hero', intensity: 0.35 }],
          sound: [{ cue: 'heartbeat', at: 0, volume: 1.3 }],
        },
      ],
      sound: [
        ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({ cue: 'kick', at: `moment:touch-${i}`, volume: 1.5 })),
        { cue: 'whoosh', at: 'moment:hopStart', volume: 1.6 },
        { cue: 'shot', at: 'moment:contact', volume: 3 },
        { cue: 'impact', at: 'moment:contact', volume: 3.2 },
        { cue: 'shock', at: 'moment:contact', volume: 1 },
      ],
    },
    // ── ACT 4 — A NATION ANSWERS ─────────────────────────────────────────────
    {
      id: 'answer',
      world: 'football',
      set: { ...night, floodTint: CRIMSON },
      ambience: false,
      beats: [
        {
          id: 'chorus',
          purpose: 'transform',
          duration: 4 * B,
          clock: { from: 7.3, to: 7.55 },
          camera: 'chorus-push',
          fx: [
            { type: 'crowd-current', at: 0.1, until: 'relight.end', props: { side: 'home', rise: 1.3 } },
            { type: 'current-lines', at: 0.8, until: 'relight.end', props: { home: true, away: false, speed: 16 } },
          ],
          text: [{ say: 'You can’t ground a nation.', style: 'title', at: 0.2, until: 'end-0.05', place: 'top' }],
          sound: [{ cue: 'stomp-clap', at: 0, duration: 3.2, volume: 1.2 }, { cue: 'crowd-muffled', at: 0, duration: 1.6, volume: 0.7 }],
        },
        {
          id: 'relight',
          purpose: 'transform',
          duration: 4 * B,
          clock: { from: 7.55, to: 7.8 },
          camera: 'relight-worm',
          fx: [
            // Crimson banks strike on beats 1-4 (window 2.5 s from -0.3 s).
            { type: 'lights-up', at: -0.3, until: 'end+0.6' },
            { type: 'aura', on: 'hero', at: 0.4, intensity: 0.7 },
          ],
          sound: [...[0, 1, 2, 3].map((i) => ({ cue: 'impact', at: i * B, volume: 3.4 })), { cue: 'anticipation', at: 0, volume: 0.7 }],
        },
      ],
    },
    plate('charge', {
      id: 'charge',
      purpose: 'transform',
      duration: 8 * B,
      enter: { type: 'flash' },
      text: [{ say: 'FULL CURRENT', style: 'broadcast', at: 2.0, until: 'end-0.05', place: 'top' }],
      // The four banks strike on beats 1-4 (baked in the plate); the frame takes each hit.
      fx: [0, 1, 2, 3].map((i) => ({ type: 'impact-shake', at: i * B, intensity: 0.45 })),
      sound: [...[0, 1, 2, 3].map((i) => ({ cue: 'impact', at: i * B, volume: 3 })), { cue: 'charge', at: 0, duration: 3.1, volume: 1.2 }, { cue: 'aura-hum', at: 0, duration: 3.2, volume: 0.9 }, { cue: 'riser-long', at: 0.2, duration: 3, volume: 0.9 }],
    }),
    // ── ACT 4 — MERIDIAN ───────────────────────────────────────────────────
    {
      id: 'meridian',
      world: 'football',
      set: { ...night, floodTint: CRIMSON },
      beats: [
        {
          id: 'leap',
          purpose: 'escalation',
          duration: 4 * B,
          clock: { from: 8.9, to: 9.18 },
          camera: 'leap-low',
          fx: [{ type: 'aura', on: 'hero', intensity: 1 }, { type: 'speed-lines', intensity: 0.6 }, { type: 'crowd-current', at: 0, until: 'net.end', props: { side: 'home', rise: 0.1 } }],
          sound: [{ cue: 'whoosh', at: 0.05, volume: 2 }, { cue: 'shock', at: 0.05, volume: 0.9 }],
        },
        {
          id: 'apex',
          purpose: 'tension',
          duration: 4 * B,
          clock: { from: 9.18, to: 9.335 },
          camera: 'volley-side-push',
          fx: [{ type: 'aura', on: 'hero', intensity: 1 }, { type: 'focus-lines', at: 0.2, intensity: 0.8 }],
          graphics: [{ kind: 'technique-card', at: 0.45, until: 'end', props: { name: 'Meridian', cast: 'hero', place: 'center' } }],
          sound: [{ cue: 'hush', at: 0, duration: 1.2 }, { cue: 'heartbeat', at: 0.05, volume: 1.4 }, { cue: 'slam-hit', at: 0.45, volume: 1.2 }],
        },
        {
          id: 'strike',
          purpose: 'payoff',
          duration: 1 * B,
          clock: { from: 9.335, to: 9.4 },
          camera: 'volley-side-tight',
          fx: [
            { type: 'aura', on: 'hero', intensity: 1 },
            { type: 'impact-frame', at: 'moment:volley', intensity: 1 },
            { type: 'shockwave', at: 'moment:volley+3f', on: 'ball', props: { color: 'TR', radius: 7, height: 2.3 } },
            { type: 'chroma', at: 'moment:volley+3f', intensity: 1 },
            { type: 'impact-shake', at: 'moment:volley', intensity: 1.2 },
            { type: 'zoom-punch', at: 'moment:volley', intensity: 1 },
            { type: 'plasma-trail', at: 'moment:volley+1f', props: { color: 'TR', fromMoment: 9.34, length: 0.05 } },
          ],
          sound: [{ cue: 'shot', at: 'moment:volley', volume: 3.4 }, { cue: 'boom', at: 'moment:volley', volume: 1.6 }, { cue: 'impact', at: 'moment:volley', volume: 4 }],
        },
        {
          id: 'meridian',
          purpose: 'payoff',
          duration: 3 * B,
          clock: { from: 9.4, to: 9.69 },
          camera: 'meridian-behind',
          fx: [
            { type: 'aura', on: 'hero', intensity: 0.8 },
            { type: 'plasma-trail', props: { color: 'TR', fromMoment: 9.34, length: 0.3 } },
            { type: 'slice', at: 0.05, until: 'end', props: { fromMoment: 9.34, toMoment: 9.62, color: 'TR' } },
            { type: 'aura', on: 'keeper', intensity: 0.6 },
          ],
          sound: [{ cue: 'fracture', at: 0.05, volume: 1.4 }, { cue: 'whoosh', at: 'moment:goalLine-0.05', volume: 2.2 }],
        },
        {
          id: 'net',
          purpose: 'payoff',
          duration: 2 * B,
          clock: { from: 9.69, to: 9.95 },
          camera: 'net-reverse',
          fx: [
            { type: 'plasma-trail', until: 'moment:netHit+2f', props: { color: 'TR', fromMoment: 9.34, length: 0.2 } },
            { type: 'flash', at: 'moment:netHit', intensity: 0.9 },
            { type: 'impact-shake', at: 'moment:netHit', intensity: 1.4 },
            { type: 'zoom-punch', at: 'moment:netHit' },
            { type: 'chroma', at: 'moment:netHit', intensity: 0.7 },
          ],
          sound: [{ cue: 'impact', at: 'moment:netHit', volume: 4 }, { cue: 'goal-sting', at: 'moment:netHit', volume: 1.6 }, { cue: 'sub-hit', at: 'moment:netHit', volume: 1.3 }],
        },
        {
          id: 'hush',
          purpose: 'reaction',
          duration: 2 * B,
          clock: { from: 9.95, to: 10.3 },
          camera: 'hush-drift',
          fx: [{ type: 'motes', props: { fall: true, color: 'TR' }, intensity: 0.8 }],
          sound: [{ cue: 'hush', at: 0, duration: 0.8 }],
        },
      ],
    },
    // ── ACT 5 — AFTERMATH / BRAND ──────────────────────────────────────────
    plate('legend', {
      id: 'legend',
      purpose: 'reaction',
      duration: 5 * B,
      sound: [{ cue: 'goal-roar', at: 0, volume: 0.9 }, { cue: 'boom', at: 0, volume: 1.1 }],
    }),
    {
      id: 'aftermath',
      world: 'football',
      set: { ...night, floodTint: CRIMSON },
      beats: [
        {
          id: 'roar',
          purpose: 'reaction',
          duration: 3 * B,
          clock: { from: 11.2, to: 12.0 },
          camera: 'scorer-push',
          fx: [{ type: 'confetti' }, { type: 'aura', on: 'hero', intensity: 0.5 }, { type: 'crowd-current', at: 0, until: 'end', props: { side: 'home', rise: 0.1 } }],
          sound: [{ cue: 'celebration', at: 0, volume: 0.6 }],
        },
        {
          id: 'table-climb',
          purpose: 'proof',
          duration: 8 * B,
          clock: { from: 12.0, to: 12.8 },
          camera: 'crane-out',
          fx: [{ type: 'stadium-grade', intensity: 0.9 }, { type: 'crowd-current', at: 0, until: 'end', props: { side: 'home', rise: 0.1 } }],
          graphics: [
            {
              kind: 'world-table',
              at: '6f',
              props: {
                rows: [{ code: 'GR', points: 41 }, { code: 'TR', points: 41 }, { code: 'BR', points: 37 }, { code: 'DE', points: 36 }, { code: 'JP', points: 34 }],
                hero: 'hero',
                gain: 3,
                climbAt: 0.9,
                exitAt: 'brand',
                lines: ['THE WORLD', 'KEEPS PLAYING.'],
                note: 'ILLUSTRATIVE STANDINGS',
              },
            },
          ],
          sound: [{ cue: 'whoosh', at: '6f', volume: 1.2 }],
        },
        {
          id: 'brand',
          purpose: 'brand',
          duration: 8 * B,
          clock: { from: 12.8, to: 13 },
          camera: 'stadium-drift',
          fx: [{ type: 'stadium-grade', at: -0.4 }],
          graphics: [{ kind: 'brand-reveal', props: { at: 'start-3f', words: ['YOUR COUNTRY.', 'YOUR LEAGUE.'], site: 'hncleague.com', footer: 'HNC: THE CURRENT' } }],
          sound: [{ cue: 'brand-sting', at: '15f', volume: 3 }],
        },
      ],
    },
  ],
};

/** Key art: the Cycles legend plate (`blender:plates --only current-legend --cycles … --out-name current-poster`) + type. */
export const THE_CURRENT_POSTER: ContentSpec = {
  id: 'the-current-poster',
  title: 'HNC: The Current — poster',
  fps: 60,
  seed: 150,
  formats: ['reel', 'portrait'],
  cast: { hero: { person: 'emre' } },
  scenes: [
    {
      id: 'poster',
      world: 'plate',
      set: { plate: 'current-poster', frames: 1 },
      ambience: false,
      beats: [
        {
          id: 'poster',
          purpose: 'brand',
          duration: 1,
          camera: 'wide',
          fx: [{ type: 'shade-top', at: 0, intensity: 0.9 }, { type: 'shade-bottom', at: 0, intensity: 0.8 }],
          text: [
            { say: 'HNC League presents', style: 'kicker', at: 0, place: 'top' },
            { say: 'The\nCurrent.', style: 'title', at: 0, place: 'upper' },
            { say: 'You can’t ground a nation.', style: 'cinema', at: 0, place: 'bottom' },
          ],
          graphics: [{ kind: 'lockup', at: 0, props: { place: 'bottom', line: 'CRESCENT CUT · UNDERTOW · BLACKOUT · MERIDIAN' } }],
        },
      ],
    },
  ],
};
