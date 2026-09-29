import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 01 — THE TOURNAMENT ENDED. THE RIVALRY DIDN'T. (30 Sep / 1 Oct)
 *
 * The campaign opener (THE WORLD KEEPS PLAYING). No marks, no trophies, no
 * claims about who played: just the quiet after a football summer. Hook: the
 * TV's end-of-coverage slate clicks to black — THE TOURNAMENT ENDED. Emre
 * puts the remote down, folds his scarf into a moving box; the room goes
 * silent. Then, from the dark hallway, a ball rolls into the lamplight and
 * stops at his feet. His phone lights up on the table. The lamp fades, cold
 * light pours through the window, a crowd rises somewhere far away — and the
 * window's light becomes a floodlight: THE RIVALRY DIDN'T.
 */
export const RIVALRY_DIDNT: ContentSpec = {
  id: 'autumn-01-rivalry-didnt',
  title: 'The Rivalry Didn’t',
  logline: 'The tournament ended. A ball rolls in from nowhere. The rivalry didn’t.',
  fps: 60,
  seed: 101,
  formats: ['reel'],
  cast: { emre: { person: 'emre', look: 'tee' }, nikos: { person: 'nikos' } },
  keyArt: { thumb: 'stops@70%' },
  scenes: [
    {
      id: 'room',
      world: 'apartment',
      set: { tv: 'tv-slate', notification: 'Greece challenged Türkiye.' },
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.5,
          camera: 'tv-wide push-in x0.5',
          cast: { emre: { at: 'sofa', hold: 'remote', do: { do: 'idle', lookAt: 'tv' } } },
          graphics: [{ kind: 'screen', at: 0.75, props: { surface: 'tv', content: 'black' } }],
          fx: [{ type: 'remote-down', at: 1.3 }],
          text: [{ say: 'the tournament ended.', style: 'cinema', at: 0.85, until: 'fold.end', place: 'top' }],
          sound: [{ cue: 'crowd-distant', duration: 0.75, volume: 0.5 }, { cue: 'remote-click', at: 0.72, volume: 1.2 }, { cue: 'tv-off', at: 0.75, volume: 1.1 }, { cue: 'hush', at: 0.75, duration: 0.8 }, { cue: 'clack', at: 1.35, volume: 0.7 }],
        },
        {
          id: 'fold',
          purpose: 'setup',
          duration: 1.4,
          camera: 'medium:emre drift-right x0.6',
          cast: { emre: { at: 'box', hold: 'scarf', do: [{ do: 'fold' }, { at: 0.95, do: 'place', lookAt: 'scarf' }] } },
          fx: [{ type: 'scarf-in', at: 1.25 }],
          sound: [{ cue: 'cloth', at: 0.1, volume: 1.1 }, { cue: 'cloth', at: 0.7, volume: 0.9 }],
        },
        {
          id: 'quiet',
          purpose: 'setup',
          duration: 1.1,
          camera: 'room-wide push-in x0.3',
          cast: { emre: { at: 'centre', hold: '', do: { do: 'idle', lookAt: 'tv' } } },
          sound: [{ cue: 'tick', at: 0.2, volume: 0.7 }, { cue: 'tick', at: 0.7, volume: 0.7 }],
        },
        {
          id: 'roll',
          purpose: 'reveal',
          duration: 1.7,
          camera: 'hall-low',
          fx: [{ type: 'ball-roll', at: 0.15, until: 'stops@70%' }],
          sound: [{ cue: 'ball-roll', at: 0.15, duration: 2.6, volume: 1.4 }, { cue: 'tension-rise', at: 0.4, duration: 2.0, volume: 0.45 }],
        },
        { id: 'notice', purpose: 'reaction', duration: 0.8, camera: 'close:emre push-in x0.5', cast: { emre: { do: { do: 'notice', lookAt: 'ball' } } } },
        { id: 'stops', purpose: 'reveal', duration: 0.85, camera: 'macro:ball>emre push-in x0.4', sound: [{ cue: 'hush', duration: 0.85 }] },
        {
          id: 'phone',
          purpose: 'reveal',
          duration: 1.0,
          camera: 'macro:phone push-in x1.3',
          fx: [{ type: 'phone-wake', at: 0.2 }],
          sound: [{ cue: 'phone-buzz', at: 0.2, volume: 1.2 }, { cue: 'notification', at: 0.22, volume: 0.6 }],
        },
        {
          id: 'shift',
          purpose: 'transform',
          duration: 1.35,
          camera: 'window-wide push-in x0.7',
          cast: { emre: { do: { do: 'look-up', lookAt: 'window-light' } } },
          fx: [{ type: 'room-shift', at: 0.05, until: 'end' }],
          sound: [{ cue: 'crowd-opening', duration: 1.35, volume: 0.9 }],
        },
      ],
    },
    {
      id: 'stadium',
      world: 'football',
      set: { moment: 'hero-attack', roles: { striker: 'emre', rival: 'nikos' }, light: 'night' },
      enter: { type: 'light-bloom', from: 'window-light', to: 'floodlight', duration: 0.6 },
      beats: [
        {
          id: 'reveal',
          purpose: 'payoff',
          duration: 1.6,
          clock: { from: 0.2, to: 1.6 },
          camera: 'ball-rise-reveal',
          text: [{ say: 'the rivalry\ndidn’t.', style: 'title', at: 0.45, until: 'hold.end', place: 'top' }],
          sound: [{ cue: 'stadium-reveal', volume: 0.9 }, { cue: 'goal-roar', at: 0.4, volume: 0.35 }],
        },
        {
          id: 'hold',
          purpose: 'brand',
          duration: 1.8,
          clock: { from: 1.6, to: 2.45 },
          camera: 'faceoff-depth-push',
          graphics: [{ kind: 'lockup', at: 0.35, props: { place: 'bottom', line: 'THE WORLD KEEPS PLAYING' } }],
          sound: [{ cue: 'heartbeat', at: 0.2, volume: 0.8 }, { cue: 'brand-sting', at: 0.4, volume: 1.8 }, { cue: 'whistle', at: 1.7, volume: 1.2 }],
        },
      ],
    },
  ],
};
