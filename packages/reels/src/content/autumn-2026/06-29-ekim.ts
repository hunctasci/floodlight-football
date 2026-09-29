import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 06 — 29 EKİM (Republic Day, 29 Oct).
 *
 * Respectful, quiet, no comedy, no rivalry, no call to action, no politics.
 * First light over an original city; a player with 29 on his back stands at
 * a rooftop parapet as a large flag lifts in the wind and the sky turns red.
 * A slow dissolve: an empty stadium at dawn, the crescent and star laid over
 * the terraces; five Turkish players walk out together, unhurried. Words
 * arrive only at the end: 29 EKİM · CUMHURİYET BAYRAMIMIZ KUTLU OLSUN.
 */
export const REPUBLIC_DAY: ContentSpec = {
  id: 'autumn-06-29-ekim',
  title: '29 Ekim',
  logline: 'Dawn over the city, a flag lifting in the wind, an empty stadium, five players walking out together.',
  fps: 60,
  seed: 2910,
  formats: ['reel'],
  cast: { lead: { country: 'TR', number: 29, name: 'Türkiye', look: 'kit' } },
  keyArt: { thumb: 'dawn@70%' },
  scenes: [
    {
      id: 'roof',
      world: 'rooftop',
      set: { flag: 'TR', dawn: 0.1 },
      ambience: false,
      beats: [
        {
          id: 'dawn',
          purpose: 'hook',
          duration: 2.0,
          camera: 'behind-wide push-in x0.35',
          cast: { lead: { at: 'edge', do: 'proud' } },
          fx: [{ type: 'dawn', at: 0, until: 'back.end' }],
          sound: [{ cue: 'wind', duration: 7.5, volume: 1.2 }, { cue: 'flag-flap', at: 0.3, duration: 6.5, volume: 0.9 }, { cue: 'pad-swell', at: 0.6, duration: 12.4, volume: 0.9 }],
        },
        { id: 'flag', purpose: 'setup', duration: 1.6, camera: 'flag-low push-in x0.4', sound: [{ cue: 'piano-note', at: 0.2, volume: 0.8 }] },
        { id: 'profile', purpose: 'setup', duration: 1.4, camera: 'profile push-in x0.3', cast: { lead: { do: { do: 'look-up' } } } },
        { id: 'back', purpose: 'transform', duration: 1.6, camera: 'high-wide drift-left x0.5', cast: { lead: { do: { do: 'proud', lookAt: 'horizon' } } } },
      ],
    },
    {
      id: 'stadium',
      world: 'football',
      set: { moment: 'walk-out', roles: { lead: 'lead' }, light: 'dawn', crowd: 'empty', tifo: 'TR', home: 'TR' },
      enter: { type: 'dissolve', duration: 1.1 },
      ambience: false,
      beats: [
        {
          id: 'walk',
          purpose: 'reveal',
          duration: 2.2,
          clock: { from: 3.0, to: 5.2 },
          camera: 'walkout-back push-in x0.3',
          sound: [{ cue: 'wind', duration: 6.6, volume: 0.7 }, { cue: 'footsteps', duration: 4.0, volume: 0.35 }, { cue: 'piano-note', at: 0.4, volume: 0.6 }],
        },
        { id: 'faces', purpose: 'reveal', duration: 1.8, clock: { from: 6.0, to: 7.8 }, camera: 'walkout-front push-in x0.3' },
        {
          id: 'republic',
          purpose: 'brand',
          duration: 2.8,
          clock: { from: 11.2, to: 14.0 },
          camera: 'walkout-high push-in x0.25',
          text: [
            { say: '29 EKİM', style: 'monument', at: 0.3, place: 'upper' },
            { say: 'CUMHURİYET BAYRAMIMIZ\nKUTLU OLSUN', style: 'dedication', at: 0.9, place: 'center' },
          ],
          graphics: [{ kind: 'lockup', at: 1.5, props: { place: 'bottom' } }],
          sound: [{ cue: 'piano-note', at: 0.3, volume: 0.9 }],
        },
      ],
    },
  ],
};
