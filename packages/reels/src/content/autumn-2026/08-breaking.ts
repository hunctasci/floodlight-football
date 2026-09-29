import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 08 — BREAKING: THE WORLD TABLE IS MOVING (3–4 Nov).
 *
 * No football: the comedy is absolute seriousness. The HNC Sports Desk's
 * anchor Kaan breaks in: the World Table is moving. Glitch — the table:
 * Japan up to third. Kaan reacts like the world has changed. Push in. The
 * banner escalates. Glitch — Türkiye takes first. Meltdown: the red frame,
 * the BREAKING strip, and the studio floor lights up as a giant World Table
 * laid across a pitch. THE TABLE NEVER SLEEPS. All standings illustrative.
 */
const NOTE = 'ILLUSTRATIVE STANDINGS · NOT LIVE DATA';
const rows1 = [
  { code: 'BR', points: 41 },
  { code: 'TR', points: 40 },
  { code: 'GR', points: 38 },
  { code: 'JP', points: 36 },
  { code: 'IT', points: 35 },
];
const rows2 = [
  { code: 'BR', points: 41 },
  { code: 'TR', points: 40 },
  { code: 'JP', points: 39 },
  { code: 'GR', points: 38 },
  { code: 'IT', points: 35 },
];
const rows3 = [
  { code: 'TR', points: 43 },
  { code: 'BR', points: 41 },
  { code: 'JP', points: 39 },
  { code: 'GR', points: 38 },
  { code: 'IT', points: 35 },
];
const studio = { screen: 'hnc-news', home: 'kaan' };

export const BREAKING: ContentSpec = {
  id: 'autumn-08-breaking',
  title: 'Breaking: The Table Is Moving',
  logline: 'The HNC Sports Desk treats a World Table update as the biggest story on Earth.',
  fps: 60,
  seed: 808,
  formats: ['reel'],
  cast: { kaan: { person: 'kaan' } },
  keyArt: { thumb: 'push@60%' },
  scenes: [
    {
      id: 'desk',
      world: 'studio',
      set: studio,
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.3,
          camera: 'wide push-in',
          cast: { kaan: { at: 'anchor-centre', do: { do: 'talk', lookAt: 'camera' } } },
          graphics: [
            { kind: 'breaking-banner', at: 0.15, until: 'read.end', props: { headline: 'The World Table is moving' } },
            { kind: 'live-bug', at: 0, until: 'read.end', props: { channel: 'HNC SPORTS' } },
          ],
          fx: [{ type: 'flash', intensity: 0.4 }],
          sound: [{ cue: 'news-sting', volume: 1.3 }, { cue: 'boom', at: 0.02, volume: 0.9 }],
        },
        {
          id: 'read',
          purpose: 'setup',
          duration: 1.2,
          camera: 'desk push-in x0.7',
          cast: { kaan: { do: [{ do: 'papers' }, { at: 0.5, do: 'talk', lookAt: 'camera' }] } },
          text: [{ say: '“…reports are coming in…”', style: 'subtitle', at: 0.15, place: 'lower' }],
          sound: [{ cue: 'news-bed', duration: 1.2, volume: 1 }],
        },
      ],
    },
    {
      id: 'table-1',
      world: 'title',
      set: { theme: 'night' },
      enter: { type: 'glitch' },
      beats: [
        {
          id: 'japan',
          purpose: 'reveal',
          duration: 1.7,
          camera: 'static',
          graphics: [{ kind: 'world-table', props: { rows: rows1, hero: 'JP', gain: 3, climbAt: 0.75, lines: ['BREAKING:', 'JAPAN UP TO 3RD.'], tag: '', note: NOTE } }],
          sound: [{ cue: 'whoosh', volume: 1 }, { cue: 'pop', at: 0.75, volume: 1 }, { cue: 'news-bed', duration: 1.7, volume: 0.8 }],
        },
      ],
    },
    {
      id: 'reaction',
      world: 'studio',
      set: { ...studio, screen: 'breaking' },
      enter: { type: 'glitch' },
      beats: [
        {
          id: 'gasp',
          purpose: 'reaction',
          duration: 0.9,
          camera: 'close:kaan crash-zoom',
          cast: { kaan: { at: 'anchor-centre', do: { do: 'gasp', lookAt: 'camera' } } },
          sound: [{ cue: 'dramatic-sting', volume: 1.2 }, { cue: 'hush', at: 0.1, duration: 0.7 }],
        },
        {
          id: 'push',
          purpose: 'escalation',
          duration: 1.2,
          camera: 'close:kaan push-in x1.3',
          cast: { kaan: { do: { do: 'talk', lookAt: 'camera' } } },
          graphics: [{ kind: 'breaking-banner', at: 0.05, props: { label: 'BREAKING · UPDATE', headline: 'This changes everything', level: 2 } }],
          text: [{ say: '“…this changes everything.”', style: 'subtitle', at: 0.2, place: 'lower' }],
          sound: [{ cue: 'breaking-alarm', at: 0.05, volume: 1 }, { cue: 'news-bed', duration: 1.2, volume: 1.1 }],
        },
      ],
    },
    {
      id: 'table-2',
      world: 'title',
      set: { theme: 'night' },
      enter: { type: 'glitch' },
      beats: [
        {
          id: 'turkiye',
          purpose: 'reveal',
          duration: 1.7,
          camera: 'static',
          graphics: [{ kind: 'world-table', props: { rows: rows2, hero: 'TR', gain: 3, climbAt: 0.7, lines: ['UPDATE:', 'TÜRKİYE TAKES 1ST.'], tag: '', note: NOTE } }],
          sound: [{ cue: 'whoosh', volume: 1 }, { cue: 'pop', at: 0.7, volume: 1 }, { cue: 'goal-roar', at: 0.75, volume: 0.35 }],
        },
      ],
    },
    {
      id: 'meltdown',
      world: 'studio',
      set: { ...studio, screen: 'breaking', rows: rows3 },
      enter: { type: 'glitch' },
      beats: [
        {
          id: 'slam',
          purpose: 'escalation',
          duration: 1.2,
          camera: 'medium:kaan handheld x1.4',
          cast: { kaan: { at: 'anchor-centre', do: [{ do: 'slam-desk' }, { at: 0.55, do: 'talk', lookAt: 'camera' }] } },
          graphics: [{ kind: 'breaking-banner', at: 0.0, until: 'floor.end', props: { label: 'BREAKING BREAKING', headline: 'The table is moving', level: 3 } }],
          sound: [{ cue: 'slam', at: 0.28, volume: 1.4 }, { cue: 'breaking-alarm', at: 0.3, volume: 1.2 }, { cue: 'breaking-alarm', at: 0.8, volume: 1.2 }],
        },
        {
          id: 'floor',
          purpose: 'payoff',
          duration: 2.2,
          camera: { lens: 'floor-rise', to: 'floor-top', ease: 'ease-in-out' },
          cast: { kaan: { do: { do: 'present', lookAt: 'camera' } } },
          fx: [{ type: 'floor-table', at: 0.05, until: 1.8 }],
          sound: [{ cue: 'riser-long', duration: 1.8, volume: 0.9 }, { cue: 'boom', at: 1.8, volume: 1 }],
        },
        {
          id: 'never-sleeps',
          purpose: 'brand',
          duration: 1.9,
          camera: 'floor-top push-in x0.3',
          text: [
            { say: 'the table\nnever sleeps.', style: 'title', at: 0.1, place: 'top' },
            { say: 'illustrative standings', style: 'kicker', at: 0.5, place: 'upper' },
          ],
          graphics: [{ kind: 'lockup', at: 0.6, props: { place: 'bottom', plate: true } }],
          sound: [{ cue: 'news-sting', at: 0.05, volume: 1 }, { cue: 'brand-sting', at: 0.65, volume: 1.6 }],
        },
      ],
    },
  ],
};
