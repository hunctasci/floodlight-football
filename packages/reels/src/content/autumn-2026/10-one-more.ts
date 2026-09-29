import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 10 — ONE MORE (France vs Türkiye, 15 Nov: Türkiye's last
 * league-phase fixture; no stakes claimed).
 *
 * The campaign's quiet ending, bookending 01. Late night, an empty office
 * corridor, one notification: ONE MORE. Emre looks up and walks. The corridor
 * becomes a service corridor, then a stadium tunnel; each cut hides behind a
 * pillar and he is a little more of a footballer each time — blazer, shirt,
 * the country shirt (the #9 appears on his back), full kit. Carpet footsteps
 * become studs on concrete become a crowd's rhythm. He stops at the mouth.
 * One breath. He walks into the light. White. ONE MORE.
 */
const walk = (from: string, to: string, look: string, duration = 1.5) => ({ at: from, look, move: { to, at: 0, duration }, do: 'walk-slow' });

export const ONE_MORE: ContentSpec = {
  id: 'autumn-10-one-more',
  title: 'One More',
  logline: 'One notification. A corridor becomes a tunnel. One more.',
  fps: 60,
  seed: 1010,
  formats: ['reel'],
  cast: { emre: { person: 'emre', look: 'office-formal' } },
  keyArt: { thumb: 'breath@40%' },
  scenes: [
    {
      id: 'walk',
      world: 'corridor',
      ambience: false,
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.5,
          camera: 'medium:emre push-in x0.4',
          cast: { emre: { at: 'office-a', hold: 'phone', do: 'phone-look' } },
          graphics: [{ kind: 'notification', at: 0.25, until: 'look-up@70%', props: { app: 'HNC League', title: 'ONE MORE.', body: 'The table is still open.' } }],
          sound: [{ cue: 'room-tone', duration: 3.2, volume: 1 }, { cue: 'phone-buzz', at: 0.2, volume: 1.1 }, { cue: 'notification', at: 0.25, volume: 0.7 }],
        },
        {
          id: 'look-up',
          purpose: 'setup',
          duration: 1.0,
          camera: 'close:emre push-in x0.5',
          cast: { emre: { do: [{ do: 'phone-look' }, { at: 0.3, do: 'look-up', lookAt: 'mouth-light' }] } },
          sound: [{ cue: 'crowd-muffled', at: 0.3, duration: 2.2, volume: 0.25 }],
        },
        {
          id: 'walk-1',
          purpose: 'escalation',
          duration: 1.5,
          camera: 'follow:emre',
          cast: { emre: { ...walk('office-a', 'office-b', 'office-formal'), hold: '' } },
          sound: [{ cue: 'footsteps', duration: 1.5, volume: 0.7 }],
        },
        {
          id: 'walk-2',
          purpose: 'escalation',
          duration: 1.5,
          camera: 'follow:emre left',
          enter: { type: 'wipe', direction: 'left', duration: 0.35 },
          cast: { emre: walk('service-a', 'service-b', 'office') },
          sound: [{ cue: 'footsteps', duration: 1.5, volume: 0.95 }, { cue: 'crowd-muffled', duration: 1.5, volume: 0.45 }],
        },
        {
          id: 'walk-3',
          purpose: 'escalation',
          duration: 1.5,
          camera: 'follow:emre',
          enter: { type: 'wipe', direction: 'right', duration: 0.35 },
          cast: { emre: walk('tunnel-a', 'tunnel-b', 'kit-trousers') },
          sound: [{ cue: 'footsteps-tunnel', duration: 1.5, volume: 0.9 }, { cue: 'crowd-muffled', duration: 1.5, volume: 0.65 }, { cue: 'stomp-clap', at: 0.5, duration: 1.0, volume: 0.35 }],
        },
        {
          id: 'walk-4',
          purpose: 'escalation',
          duration: 1.5,
          camera: 'follow-low:emre',
          enter: { type: 'wipe', direction: 'left', duration: 0.35 },
          cast: { emre: walk('tunnel-c', 'tunnel-d', 'kit') },
          sound: [{ cue: 'footsteps-tunnel', duration: 1.5, volume: 1.1 }, { cue: 'stomp-clap', duration: 1.5, volume: 0.7 }, { cue: 'crowd-opening', duration: 2.9, volume: 0.8 }],
        },
        {
          id: 'mouth',
          purpose: 'tension',
          duration: 1.4,
          camera: 'mouth-reverse push-in x0.5',
          cast: { emre: { at: 'tunnel-e', look: 'kit', move: { to: 'mouth', at: 0, duration: 1.2 }, do: [{ do: 'walk-slow' }, { at: 1.2, do: 'proud', lookAt: 'camera' }] } },
          sound: [{ cue: 'footsteps-tunnel', duration: 1.2, volume: 1.1 }, { cue: 'stomp-clap', duration: 1.4, volume: 0.95 }],
        },
        {
          id: 'breath',
          purpose: 'tension',
          duration: 1.1,
          camera: 'close:emre push-in x0.35',
          cast: { emre: { do: { do: 'breath' } } },
          sound: [{ cue: 'hush', duration: 1.1 }, { cue: 'heartbeat2', duration: 1.1, volume: 0.8 }],
        },
        {
          id: 'light',
          purpose: 'payoff',
          duration: 1.3,
          camera: 'follow:emre push-in x0.3',
          cast: { emre: { move: { to: 'threshold', at: 0.1, duration: 1.2 }, do: 'walk-slow' } },
          sound: [{ cue: 'roar-opening', at: 0.15, volume: 1 }, { cue: 'riser-long', duration: 1.3, volume: 0.8 }],
        },
      ],
    },
    {
      id: 'white',
      world: 'title',
      set: { theme: 'white' },
      enter: { type: 'white-out', duration: 0.9 },
      beats: [
        {
          id: 'card',
          purpose: 'brand',
          duration: 1.9,
          camera: 'static',
          text: [{ say: 'ONE MORE.', style: 'cinema-ink', at: 0.25, place: 'center' }],
          graphics: [{ kind: 'lockup', at: 0.75, props: { place: 'bottom', tone: 'dark' } }],
          sound: [{ cue: 'crowd-bed', duration: 1.9, volume: 0.5 }, { cue: 'brand-sting', at: 0.75, volume: 1.6 }],
        },
      ],
    },
  ],
};
