import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 09 — THE REMATCH (Türkiye vs Belgium, 12 Nov). Callback to 02.
 *
 * Hook: the exact symmetrical frame of The Coffee Machine Incident — but the
 * counter is bare. The office has learned: a new notice ("NO FOOTBALL IN THE
 * KITCHEN"), blinds shut, a phone goes in a drawer, a coworker slips out.
 * Emre and Lucas walk in together; they already know. The machine blinks
 * REMATCH. Knuckles. Tie. One flicker and we're straight in (faster than 02,
 * because the audience has seen it). Payoff flips 02: Lucas strikes, Belgium
 * in red, Türkiye in their clash white — the crossbar rings, the ball rises
 * into the night. Punchline: it lands in the coffee machine. Nobody wins.
 */
export const REMATCH: ContentSpec = {
  id: 'autumn-09-rematch',
  title: 'The Rematch',
  logline: 'Same kitchen, same two coworkers, round two. The office is prepared. The coffee machine is not.',
  fps: 60,
  seed: 909,
  formats: ['reel'],
  cast: { emre: { person: 'emre' }, lucas: { person: 'lucas' }, giulia: { person: 'giulia' }, mateo: { person: 'mateo' }, yuki: { person: 'yuki' } },
  keyArt: { thumb: 'rematch@50%' },
  scenes: [
    {
      id: 'kitchen',
      world: 'breakroom',
      set: { display: 'machine-ready', cup: false, cleared: true, sign: ['NO FOOTBALL', 'IN THE', 'KITCHEN'] },
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.2,
          camera: { lens: 'symmetry', move: ['push-in'], amount: 0.3 },
          cast: {
            giulia: { at: 'table-a', do: { do: 'idle', lookAt: 'camera' } },
            mateo: { at: 'table-b', do: { do: 'idle', lookAt: 'camera' } },
            yuki: { at: 'window', do: { do: 'idle' } },
          },
          text: [
            { say: 'Türkiye vs Belgium · round 2', style: 'kicker', at: 0.05, until: 'blinds.end', place: 'top' },
            { say: 'the office remembers.', style: 'pov', at: 0.2, until: 'hook.end', place: 'upper' },
          ],
          sound: [{ cue: 'hush', at: 0, duration: 1.0 }],
        },
        { id: 'sign', purpose: 'clue', duration: 0.6, camera: 'sign-close push-in x0.5', sound: [{ cue: 'tick', at: 0.1 }] },
        {
          id: 'blinds',
          purpose: 'setup',
          duration: 0.7,
          camera: 'window-side',
          cast: { yuki: { do: { do: 'pull-cord' } } },
          fx: [{ type: 'blinds-close', at: 0.18, until: 0.66 }],
          sound: [{ cue: 'blinds', at: 0.18, duration: 0.5, volume: 1.2 }],
        },
        {
          id: 'exit',
          purpose: 'setup',
          duration: 0.75,
          camera: 'exit-view drift-left x0.4',
          cast: { giulia: { move: { to: 'door', at: 0, duration: 1.1 }, do: 'walk-slow' } },
          sound: [{ cue: 'footsteps', duration: 0.75, volume: 0.5 }],
        },
        {
          id: 'enter',
          purpose: 'tension',
          duration: 1.05,
          camera: { lens: 'symmetry', move: ['push-in'], amount: 0.45 },
          cast: {
            emre: { at: 'walk-left', move: { to: 'cup-left', at: 0, duration: 0.95 }, do: [{ do: 'walk' }, { at: 0.95, do: 'stare-down', lookAt: 'lucas' }] },
            lucas: { at: 'walk-right', move: { to: 'cup-right', at: 0, duration: 0.95 }, do: [{ do: 'walk' }, { at: 0.95, do: 'stare-down', lookAt: 'emre' }] },
            yuki: { at: 'window', do: { do: 'idle' } },
            mateo: { at: 'table-b', do: { do: 'idle', lookAt: 'emre' } },
          },
          sound: [{ cue: 'footsteps', duration: 0.95, volume: 1 }, { cue: 'footsteps', at: 0.02, duration: 0.95, volume: 0.9 }],
        },
        {
          id: 'rematch',
          purpose: 'reveal',
          duration: 0.75,
          camera: 'macro:machine push-in',
          cast: { emre: { lookAt: 'machine' }, lucas: { lookAt: 'machine' } },
          graphics: [{ kind: 'screen', props: { surface: 'machine-display', content: 'machine-rematch' } }],
          sound: [{ cue: 'machine-beep', volume: 0.9 }, { cue: 'dramatic-sting', at: 0.08, volume: 1.1 }],
        },
        {
          id: 'knuckles',
          purpose: 'escalation',
          duration: 0.75,
          camera: 'standoff-right push-in x0.8',
          cast: { lucas: { do: { do: 'knuckles', lookAt: 'emre' } } },
          sound: [{ cue: 'knuckles', at: 0.24, volume: 1.4 }],
        },
        {
          id: 'tie',
          purpose: 'escalation',
          duration: 0.75,
          camera: 'standoff-left push-in x0.8',
          cast: { emre: { do: { do: 'adjust-tie', lookAt: 'lucas' } } },
          sound: [{ cue: 'cloth', at: 0.05, volume: 1.2 }, { cue: 'tension-rise', at: 0.1, duration: 0.9, volume: 1.1 }],
        },
        {
          id: 'surge',
          purpose: 'transform',
          duration: 0.45,
          camera: { lens: 'symmetry', move: ['crash-zoom'], amount: 1 },
          fx: [{ type: 'lights-surge', at: 0.05 }],
          sound: [{ cue: 'flicker', duration: 0.3, volume: 1.1 }],
        },
      ],
    },
    {
      id: 'pitch',
      world: 'football',
      set: { moment: 'hero-attack-bar', roles: { striker: 'lucas', rival: 'emre' }, light: 'night' },
      enter: { type: 'light-bloom', from: 'tube', to: 'floodlight', duration: 0.4 },
      beats: [
        {
          id: 'faceoff',
          purpose: 'tension',
          duration: 0.8,
          clock: { from: 1.7, to: 2.5 },
          camera: { lens: 'faceoff-depth-push', move: ['tilt-from:floodlight'], ease: 'ease-out' },
          text: [{ say: 'LUCAS · #4', style: 'label', at: 0.25, place: 'on:lucas' }],
          sound: [{ cue: 'stadium-reveal', volume: 0.8 }],
        },
        { id: 'burst', purpose: 'escalation', duration: 0.6, clock: { from: 2.5, to: 3.1 }, camera: 'runner-burst' },
        {
          id: 'strike',
          purpose: 'payoff',
          duration: 1.2,
          clock: { from: 5.5, to: 6.5, ramp: 'anticipation-snap' },
          camera: 'striker-windup',
          enter: { type: 'whip-pan', direction: 'right' },
          fx: [
            { type: 'impact-burst', at: 'moment:contact' },
            { type: 'impact-shake', at: 'moment:contact', intensity: 0.9 },
            { type: 'zoom-punch', at: 'moment:contact', intensity: 0.8 },
            { type: 'ball-trail', at: 'moment:contact+1f' },
          ],
          sound: [{ cue: 'crowd-gasp', at: 'moment:contact-1.2', volume: 0.7 }],
        },
        {
          id: 'bar',
          purpose: 'reveal',
          duration: 0.6,
          clock: { from: 6.44, to: 6.95 },
          camera: 'net-reverse',
          fx: [{ type: 'impact-shake', at: 'moment:barHit', intensity: 1.2 }, { type: 'flash', at: 'moment:barHit', intensity: 0.4 }, { type: 'ball-trail', at: 'moment:barHit+2f' }],
          sound: [{ cue: 'crossbar', at: 'moment:barHit', volume: 3 }, { cue: 'disappointment', at: 'moment:barHit+0.1', volume: 0.8 }],
        },
        {
          id: 'sky',
          purpose: 'transform',
          duration: 0.55,
          clock: { from: 6.95, to: 7.5 },
          camera: 'look-up:ball',
          sound: [{ cue: 'whoosh', at: 0.05, volume: 1.6 }, { cue: 'riser-long', duration: 0.55, volume: 0.8 }],
        },
      ],
      sound: [
        { cue: 'shot', at: 'moment:contact', volume: 3 },
        { cue: 'impact', at: 'moment:contact', volume: 3.5 },
      ],
    },
    {
      id: 'aftermath',
      world: 'breakroom',
      set: { display: 'machine-broken', cup: false, cleared: true, broken: true, blinds: 1, sign: ['NO FOOTBALL', 'IN THE', 'KITCHEN'] },
      enter: { type: 'match-cut' },
      beats: [
        {
          id: 'crash',
          purpose: 'punchline',
          duration: 0.7,
          camera: 'machine-mid pull-out x0.6',
          cast: {
            emre: { at: 'cup-left', do: { do: 'gasp', lookAt: 'machine' } },
            lucas: { at: 'cup-right', do: { do: 'gasp', lookAt: 'machine' } },
          },
          fx: [{ type: 'impact-shake', at: 0, intensity: 1.4 }, { type: 'flash', at: 0, intensity: 0.5 }],
          sound: [{ cue: 'crash', at: 0, volume: 1.4 }, { cue: 'impact', at: 0, volume: 2.5 }, { cue: 'hush', at: 0.2, duration: 1.2 }],
        },
        {
          id: 'stare',
          purpose: 'reaction',
          duration: 2.2,
          camera: { lens: 'symmetry', move: ['push-in'], amount: 0.35 },
          cast: {
            emre: { do: [{ do: 'freeze', lookAt: 'machine' }, { at: 1.0, do: 'idle', lookAt: 'lucas' }] },
            lucas: { do: [{ do: 'freeze', lookAt: 'machine' }, { at: 1.1, do: 'idle', lookAt: 'emre' }] },
          },
          text: [{ say: 'round 3?', style: 'title', at: 1.2, place: 'top' }],
          graphics: [{ kind: 'lockup', at: 1.4, props: { place: 'bottom' } }],
          sound: [{ cue: 'machine-beep', at: 0.5, volume: 0.5 }, { cue: 'machine-beep', at: 1.1, volume: 0.35 }, { cue: 'brand-sting', at: 1.35, volume: 2 }],
        },
      ],
    },
  ],
};
