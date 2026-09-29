import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 07 — THE KEEPER WHO DOESN'T BLINK (31 Oct, Halloween).
 *
 * A short horror film played for a laugh. Midnight, an empty stadium in fog,
 * one floodlight. Nikos walks on; the keeper on the line never moves — only
 * his head follows. Nikos blinks, nervously; the keeper does not. The ball
 * rolls out of the dark to the spot on its own. Penalty. The lights die
 * before we see it. BLACK — a huge save. The lights stutter back: the keeper
 * is standing right beside him, ball in his hands. Some keepers never sleep.
 */
const midnight = { moment: 'midnight-penalty', roles: { striker: 'nikos', keeper: 'keeper' }, light: 'horror', crowd: 'empty' };

export const KEEPER: ContentSpec = {
  id: 'autumn-07-keeper',
  title: 'The Keeper Who Doesn’t Blink',
  logline: 'Midnight. Empty stadium. One keeper who never moves, never blinks.',
  fps: 60,
  seed: 3110,
  formats: ['reel'],
  cast: { nikos: { person: 'nikos' }, keeper: { person: 'keeper' } },
  keyArt: { thumb: 'stare@60%' },
  scenes: [
    {
      id: 'stadium',
      world: 'football',
      set: midnight,
      ambience: false,
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.6,
          clock: { from: 1.0, to: 2.6 },
          camera: 'goal-behind push-in x0.4',
          text: [{ say: '31.10 · 23:59 · empty stadium', style: 'kicker', at: 0.1, until: 'walk.end', place: 'top' }],
          sound: [{ cue: 'wind', duration: 14, volume: 0.9 }, { cue: 'horror-drone', duration: 11.5, volume: 0.8 }, { cue: 'buzz', duration: 11.5, volume: 0.35 }],
        },
        { id: 'walk', purpose: 'setup', duration: 1.4, clock: { from: 2.6, to: 4.0 }, camera: 'follow:nikos', sound: [{ cue: 'footsteps', duration: 1.4, volume: 0.35 }] },
        { id: 'look', purpose: 'setup', duration: 1.3, clock: { from: 4.5, to: 5.8 }, camera: 'close:nikos push-in x0.4' },
        {
          id: 'stare',
          purpose: 'tension',
          duration: 1.1,
          clock: { from: 5.8, to: 6.9 },
          camera: 'close:keeper push-in x0.7',
          text: [{ say: 'he hasn’t blinked.', style: 'horror', at: 0.25, place: 'lower' }],
          sound: [{ cue: 'heartbeat', at: 0.1, volume: 0.9 }],
        },
        {
          id: 'roll',
          purpose: 'reveal',
          duration: 1.7,
          clock: { from: 6.7, to: 8.4 },
          camera: 'spot-low push-in x0.3',
          sound: [{ cue: 'ball-roll', duration: 1.7, volume: 1.4 }, { cue: 'tension-rise', at: 0.4, duration: 1.3, volume: 0.6 }],
        },
        { id: 'notice', purpose: 'reaction', duration: 0.8, clock: { from: 8.9, to: 9.7 }, camera: 'close:nikos push-in x0.6', sound: [{ cue: 'hush', duration: 0.8 }] },
        { id: 'approach', purpose: 'tension', duration: 1.3, clock: { from: 10.1, to: 11.4 }, camera: 'over-shoulder:nikos>keeper push-in x0.8', sound: [{ cue: 'heartbeat2', duration: 1.3, volume: 0.9 }] },
        { id: 'eyes', purpose: 'tension', duration: 0.55, clock: { from: 11.4, to: 11.95 }, camera: 'close:keeper crash-zoom', sound: [{ cue: 'hush', duration: 0.55 }] },
        {
          id: 'shot',
          purpose: 'payoff',
          duration: 0.5,
          clock: { from: 11.95, to: 12.45 },
          camera: 'striker-windup',
          fx: [{ type: 'impact-shake', at: 'moment:contact', intensity: 0.7 }, { type: 'lights-out', at: 'moment:contact+0.1', until: 'end' }],
          sound: [{ cue: 'shot', at: 'moment:contact', volume: 1.4 }, { cue: 'flicker', at: 'moment:contact+0.1', volume: 1.2 }],
        },
      ],
    },
    {
      id: 'dark',
      world: 'title',
      set: { theme: 'black' },
      beats: [
        {
          id: 'black',
          purpose: 'reveal',
          duration: 1.0,
          camera: 'static',
          sound: [{ cue: 'keeper-save', at: 0.35, volume: 1.2 }, { cue: 'impact', at: 0.35, volume: 0.9 }, { cue: 'horror-hit', at: 0.35, volume: 0.6 }],
        },
      ],
    },
    {
      id: 'beside',
      world: 'football',
      set: midnight,
      ambience: false,
      beats: [
        {
          id: 'lights',
          purpose: 'punchline',
          duration: 2.1,
          clock: { from: 13.6, to: 15.7 },
          camera: 'two-shot:nikos>keeper push-in x0.4',
          fx: [{ type: 'lights-up', at: 0, until: 0.45 }],
          sound: [{ cue: 'impact', at: 0.07, volume: 1.3 }, { cue: 'impact', at: 0.14, volume: 1.3 }, { cue: 'buzz', duration: 2.1, volume: 0.4 }, { cue: 'hush', at: 0.9, duration: 1.0 }],
        },
        {
          id: 'never-sleep',
          purpose: 'brand',
          duration: 2.0,
          clock: { from: 15.7, to: 17 },
          camera: 'close:keeper right push-in x0.5',
          text: [
            { say: 'some keepers\nnever sleep.', style: 'horror', at: 0.1, place: 'upper' },
            { say: 'happy halloween', style: 'kicker', at: 0.7, place: 'lower' },
          ],
          graphics: [{ kind: 'lockup', at: 0.9, props: { place: 'bottom' } }],
          sound: [{ cue: 'horror-hit', at: 0.05, volume: 0.8 }, { cue: 'brand-sting', at: 0.95, volume: 1.4 }],
        },
      ],
    },
  ],
};
