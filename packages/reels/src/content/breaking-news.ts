import type { ContentSpec } from '../engine/spec/types';

/**
 * DEMO C — "BREAKING: Türkiye overtakes Greece" (no football gameplay).
 *
 * A sports-news parody in the HNC studio. The lead anchor (Emre, TR) reads
 * the World Table news with barely hidden joy; his co-anchor (Nikos, GR) is
 * live on air and slowly dies inside. The camera pushes into the studio wall
 * and through it into the World Table climb itself. Punchline: Nikos walks
 * off live while Emre sips. Brand: the table never lies.
 */
export const BREAKING_NEWS: ContentSpec = {
  id: 'breaking-news',
  title: 'Breaking News',
  logline: 'HNC Sports breaking news: Türkiye passes Greece in the World Table. The Greek co-anchor is live on air.',
  fps: 30,
  seed: 11,
  formats: ['reel', 'portrait', 'square'],
  cast: {
    hero: { country: 'TR', number: 9, name: 'Emre', look: 'suit' },
    rival: { country: 'GR', number: 4, name: 'Nikos', look: 'suit' },
  },
  keyArt: { thumb: 'slow-turn@70%', table: 'table@80%' },
  scenes: [
    {
      id: 'studio',
      world: 'studio',
      set: { screen: 'breaking', home: 'hero', away: 'rival' },
      beats: [
        {
          id: 'sting',
          purpose: 'hook',
          duration: 1.4,
          camera: 'wide push-in',
          cast: {
            hero: { at: 'anchor-left', do: { do: 'talk', lookAt: 'camera' } },
            rival: { at: 'anchor-right', do: { do: 'idle', lookAt: 'camera' } },
          },
          graphics: [{ kind: 'breaking-banner', at: 0.25, until: 'read.end', props: { headline: 'Türkiye passes Greece in the World Table' } }],
          fx: [{ type: 'flash', intensity: 0.5 }],
          sound: [{ cue: 'news-sting', volume: 1.3 }, { cue: 'boom', at: 0.02, volume: 0.9 }],
        },
        {
          id: 'read',
          purpose: 'setup',
          duration: 1.7,
          camera: 'medium:hero push-in',
          cast: { hero: { do: [{ do: 'talk', lookAt: 'camera' }, { at: 1.2, do: 'smug', lookAt: 'camera' }] } },
          text: [{ say: '“…Türkiye move above Greece.”', style: 'subtitle', at: 0.1, until: 'end-3f', place: 'lower' }],
          sound: [{ cue: 'news-bed', duration: 1.7, volume: 0.9 }],
        },
        {
          id: 'slow-turn',
          purpose: 'reaction',
          duration: 1.5,
          camera: 'medium:rival push-in',
          cast: {
            rival: { do: [{ do: 'freeze', lookAt: 'camera' }, { at: 0.45, do: 'side-eye', lookAt: 'hero' }] },
            hero: { do: { do: 'smug', lookAt: 'camera' } },
          },
          graphics: [{ kind: 'lower-third', at: 0.2, props: { cast: 'rival', role: 'Co-anchor · Greece fan' } }],
          text: [{ say: '* still live *', style: 'whisper', at: 0.6, place: 'upper' }],
          sound: [{ cue: 'hush', at: 0.1, duration: 1.3 }, { cue: 'tick', at: 0.5 }, { cue: 'tick', at: 1.0 }],
        },
        {
          id: 'to-screen',
          purpose: 'proof',
          duration: 0.8,
          camera: 'screen push-in x1.4',
          graphics: [{ kind: 'screen', props: { surface: 'studio-screen', content: 'world-table' } }],
          sound: [{ cue: 'whoosh', at: 0.3, volume: 1.2 }],
        },
      ],
    },
    {
      id: 'table',
      world: 'title',
      set: { theme: 'night' },
      enter: { type: 'zoom-through', from: 'studio-screen', duration: 0.45 },
      beats: [
        {
          id: 'table',
          purpose: 'proof',
          duration: 2.2,
          camera: 'static',
          graphics: [{ kind: 'world-table', at: 0.05, props: { hero: 'hero', rival: 'rival', climbAt: 0.85, lines: ['TÜRKİYE', 'MOVES UP.'] } }],
          sound: [{ cue: 'swipe', at: 0.85 }, { cue: 'pop', at: 1.0 }, { cue: 'news-bed', duration: 2.2, volume: 0.6 }],
        },
      ],
    },
    {
      id: 'live',
      world: 'studio',
      set: { screen: 'world-table', home: 'hero', away: 'rival' },
      enter: { type: 'whip-pan', direction: 'right' },
      beats: [
        {
          id: 'meltdown',
          purpose: 'escalation',
          duration: 1.4,
          camera: 'medium:rival push-in x1.5',
          cast: {
            hero: { at: 'anchor-left', hold: 'mug', do: { do: 'smug', lookAt: 'rival' } },
            rival: { at: 'anchor-right', do: [{ do: 'deflate' }, { at: 0.75, do: 'head-shake' }] },
          },
          graphics: [{ kind: 'lower-third', at: 0.1, props: { cast: 'rival', role: 'Visibly fine' } }],
          sound: [{ cue: 'heartbeat', at: 0.1 }],
        },
        {
          id: 'walk-off',
          purpose: 'punchline',
          duration: 1.5,
          camera: 'full:rival',
          cast: {
            rival: { do: [{ do: 'stand-up' }, { at: 0.5, do: 'storm' }], move: { to: 'exit-right', at: 0.5, duration: 1.1 } },
            hero: { do: { do: 'smug', lookAt: 'rival' } },
          },
          graphics: [{ kind: 'live-bug', at: 0.05, until: 'sip.end', props: { channel: 'HNC SPORTS' } }],
          sound: [{ cue: 'chair', at: 0.1 }, { cue: 'slam', at: 0.45, volume: 0.6 }],
        },
        {
          id: 'sip',
          purpose: 'punchline',
          duration: 1.4,
          camera: 'medium:hero push-in',
          cast: { hero: { do: [{ do: 'sip', lookAt: 'camera' }, { at: 1.0, do: 'talk', lookAt: 'camera' }] } },
          graphics: [{ kind: 'ticker', at: 0.05, props: { items: ['CO-ANCHOR HAS LEFT THE STUDIO', 'GREECE REQUESTS A REMATCH', 'WORLD TABLE UPDATES EVERY MATCH', 'PLAY FOR YOUR COUNTRY AT HNCLEAGUE.COM'] } }],
          sound: [{ cue: 'news-bed', duration: 1.4, volume: 0.8 }],
        },
      ],
    },
    {
      id: 'brand',
      world: 'title',
      set: { theme: 'night' },
      enter: { type: 'wipe', direction: 'right' },
      beats: [
        {
          id: 'card',
          purpose: 'brand',
          duration: 1.8,
          camera: 'static',
          graphics: [{ kind: 'brand-reveal', props: { words: ['THE', 'TABLE', 'NEVER LIES.'], site: 'hncleague.com', footer: 'YOUR COUNTRY. YOUR LEAGUE.' } }],
          sound: [{ cue: 'brand-sting', at: 0.4, volume: 3 }],
        },
      ],
    },
  ],
};
