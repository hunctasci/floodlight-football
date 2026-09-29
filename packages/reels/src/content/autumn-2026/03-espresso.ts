import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 03 — ESPRESSO → SCREAMER (Italy vs Türkiye, 5 Oct).
 *
 * No Italy clichés: a good café, a good espresso, a Turkish striker. Hook: a
 * top-down macro of crema. Emre turns the cup on its saucer — slowly, then
 * faster, faster — MATCH CUT at full spin: the ball spinning on the grass in
 * slow motion; the camera rises and a free kick assembles itself around it.
 * ONE SHOT. He curls it over the wall into the top corner. The net bulges —
 * cut on the impact — and back in the café the crema ripples. He drinks.
 * MAKE IT COUNT.
 */
export const ESPRESSO: ContentSpec = {
  id: 'autumn-03-espresso',
  title: 'Espresso → Screamer',
  logline: 'A spinning espresso cup becomes a spinning ball. One shot.',
  fps: 60,
  seed: 305,
  formats: ['reel'],
  cast: {
    emre: { person: 'emre', look: 'office-formal' },
    barista: { country: 'TR', number: 3, name: 'Barista', look: 'tee', accent: '#2b2b2b' },
  },
  keyArt: { thumb: 'faster@80%' },
  scenes: [
    {
      id: 'cafe',
      world: 'cafe',
      set: { tod: 'dusk' },
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.2,
          camera: 'cup-top push-in x0.25',
          cast: { emre: { at: 'seat', do: { do: 'idle', lookAt: 'espresso' } }, barista: { at: 'barista-table', do: { do: 'place', lookAt: 'espresso' } } },
          text: [{ say: 'Italy vs Türkiye', style: 'kicker', at: 0.15, until: 'receive.end', place: 'top' }],
          sound: [{ cue: 'cup-set', at: 0.08, volume: 1.1 }, { cue: 'spoon-clink', at: 0.5, volume: 0.8 }, { cue: 'room-tone', duration: 5, volume: 1.2 }],
        },
        {
          id: 'receive',
          purpose: 'setup',
          duration: 1.0,
          camera: 'window-two push-in x0.4',
          cast: { barista: { move: { to: 'barista-away', at: 0.05, duration: 1.4 }, do: 'walk-slow' }, emre: { do: { do: 'nod', lookAt: 'espresso' } } },
          sound: [{ cue: 'footsteps', duration: 1.0, volume: 0.4 }],
        },
        {
          id: 'turn',
          purpose: 'setup',
          duration: 1.1,
          camera: 'cup-side push-in x0.5',
          cast: { emre: { do: { do: 'fiddle', lookAt: 'espresso' } } },
          fx: [{ type: 'cup-turn', at: 0.2, until: 'faster.end' }],
          sound: [{ cue: 'ceramic-spin', at: 0.25, duration: 0.9, volume: 0.8 }],
        },
        {
          id: 'faster',
          purpose: 'escalation',
          duration: 1.2,
          camera: 'cup-top push-in x0.6',
          sound: [{ cue: 'ceramic-spin', duration: 1.2, volume: 1.2 }, { cue: 'riser-long', duration: 1.2, volume: 0.7 }, { cue: 'hush', at: 0.2, duration: 1.0 }],
        },
      ],
    },
    {
      id: 'pitch',
      world: 'football',
      set: { moment: 'free-kick', roles: { striker: 'emre' }, light: 'night', away: 'IT' },
      enter: { type: 'match-cut' },
      beats: [
        {
          id: 'spin',
          purpose: 'transform',
          duration: 1.5,
          clock: { from: 0, to: 0.9 },
          camera: 'ball-overhead-rise',
          text: [{ say: 'one shot.', style: 'title', at: 0.7, until: 'strike@60%', place: 'top' }],
          sound: [{ cue: 'whoosh', at: 0.55, volume: 1.2 }, { cue: 'stadium-reveal', at: 0.45, volume: 0.9 }],
        },
        { id: 'setup', purpose: 'tension', duration: 0.9, clock: { from: 1.2, to: 2.1 }, camera: 'kick-behind drift-left x0.4', sound: [{ cue: 'anticipation', volume: 0.6 }] },
        {
          id: 'strike',
          purpose: 'payoff',
          duration: 1.0,
          clock: { from: 2.1, to: 3.1 },
          camera: 'striker-windup',
          fx: [{ type: 'impact-burst', at: 'moment:contact' }, { type: 'impact-shake', at: 'moment:contact', intensity: 0.8 }, { type: 'zoom-punch', at: 'moment:contact', intensity: 0.7 }, { type: 'ball-trail', at: 'moment:contact+1f' }],
          sound: [{ cue: 'shot', at: 'moment:contact', volume: 3 }, { cue: 'impact', at: 'moment:contact', volume: 3 }],
        },
        {
          id: 'curl',
          purpose: 'payoff',
          duration: 0.85,
          clock: { from: 3.1, to: 4.0 },
          camera: 'net-reverse',
          fx: [{ type: 'ball-trail', until: 'moment:netHit+1f' }, { type: 'impact-shake', at: 'moment:netHit', intensity: 1.2 }, { type: 'zoom-punch', at: 'moment:netHit' }],
          sound: [{ cue: 'whoosh', at: 'moment:goalLine-0.1', volume: 2 }, { cue: 'impact', at: 'moment:netHit', volume: 4 }, { cue: 'goal-sting', at: 'moment:netHit', volume: 2 }, { cue: 'goal-roar', at: 'moment:netHit', volume: 0.8 }],
        },
      ],
    },
    {
      id: 'after',
      world: 'cafe',
      set: { tod: 'dusk' },
      enter: { type: 'match-cut' },
      beats: [
        {
          id: 'ripple',
          purpose: 'punchline',
          duration: 1.0,
          camera: 'cup-top',
          cast: { emre: { at: 'seat', do: { do: 'idle', lookAt: 'espresso' } } },
          fx: [{ type: 'ripple', at: 0, until: 0.95 }],
          sound: [{ cue: 'roar-muffled', at: 0, volume: 0.7 }, { cue: 'spoon-clink', at: 0.02, volume: 0.9 }],
        },
        {
          id: 'drink',
          purpose: 'brand',
          duration: 1.9,
          camera: 'window-two push-in x0.3',
          cast: { emre: { hold: 'espresso', do: [{ do: 'sip', lookAt: 'espresso' }, { at: 1.25, do: 'smug', lookAt: 'camera' }] } },
          fx: [{ type: 'espresso-take', at: 0 }],
          text: [{ say: 'make it count.', style: 'title', at: 0.4, place: 'top' }],
          graphics: [{ kind: 'lockup', at: 0.85, props: { place: 'bottom' } }],
          sound: [{ cue: 'sip', at: 0.35, volume: 1 }, { cue: 'cup-set', at: 1.4, volume: 0.6 }, { cue: 'brand-sting', at: 0.9, volume: 1.8 }],
        },
      ],
    },
  ],
};
