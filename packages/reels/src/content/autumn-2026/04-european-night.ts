import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 04 — EUROPEAN NIGHT LEAKS INTO THE OFFICE (13–14 Oct).
 *
 * No competition marks, no clubs: just the culture of a big European night.
 * Hook: a late office lit only by monitors. Curiosity: every desk is hiding
 * something — a stream tucked under a spreadsheet, one earbud, a score page
 * on refresh, commentary leaking. Escalation: the boss walks the aisle,
 * everyone becomes violently productive; he passes; one collective exhale.
 * Surprise: every screen goes black. Silence. One wakes up: YOUR MATCH IS
 * READY. Transform: the office becomes a stadium in one continuous crane —
 * the carpet turns to pitch, the panels to floodlights, coworkers to fans.
 * Payoff: EVERYONE HAS A MATCH TONIGHT. SO DO YOU.
 */
export const EUROPEAN_NIGHT: ContentSpec = {
  id: 'autumn-04-european-night',
  title: 'European Night',
  logline: 'Late shift on a big European night. Everyone is secretly watching. Then every screen goes black.',
  fps: 60,
  seed: 404,
  formats: ['reel'],
  cast: {
    emre: { person: 'emre' },
    mateo: { person: 'mateo' },
    giulia: { person: 'giulia' },
    yuki: { person: 'yuki' },
    boss: { person: 'boss' },
  },
  keyArt: { thumb: 'your-match@70%' },
  scenes: [
    {
      id: 'late',
      world: 'office',
      set: {
        time: 'night',
        clock: '21:47',
        extras: 0,
        screens: { 'pod-left-a-monitor': 'stream-hidden', 'desk-b-monitor': 'score-refresh', 'desk-a-monitor': 'spreadsheet', 'pod-right-a-monitor': 'spreadsheet' },
      },
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.5,
          camera: 'aisle-dolly push-in x0.7',
          cast: {
            emre: { at: 'desk-a', do: 'typing' },
            mateo: { at: 'desk-b', do: { do: 'lean-in', lookAt: 'desk-b-monitor' } },
            giulia: { at: 'pod-left-a', do: { do: 'lean-in', lookAt: 'pod-left-a-monitor' } },
            yuki: { at: 'pod-right-a', do: 'earbud' },
          },
          text: [
            { say: '21:47 · big European night', style: 'kicker', at: 0.05, until: 'stream.end', place: 'top' },
            { say: 'everyone’s “working late”.', style: 'pov', at: 0.2, until: 'stream.end', place: 'upper' },
          ],
          sound: [{ cue: 'typing', duration: 1.5, volume: 0.6 }, { cue: 'crowd-distant', duration: 1.5, volume: 0.25 }],
        },
        {
          id: 'stream',
          purpose: 'clue',
          duration: 0.85,
          camera: 'insert:pod-left-a-monitor right push-in x0.6',
          sound: [{ cue: 'roar-muffled', at: 0.1, volume: 0.35 }],
        },
        {
          id: 'earbud',
          purpose: 'clue',
          duration: 0.8,
          camera: 'close:yuki right push-in x0.5',
          text: [{ say: '* one earbud in *', style: 'whisper', at: 0.1, until: 'refresh@40%', place: 'lower' }],
          sound: [{ cue: 'crowd-muffled', duration: 0.8, volume: 0.35 }],
        },
        {
          id: 'refresh',
          purpose: 'clue',
          duration: 0.8,
          camera: 'over-shoulder:emre>mateo push-in x0.6',
          cast: { mateo: { hold: 'phone', do: [{ do: 'phone-look' }, { at: 0.35, do: 'phone-gasp' }, { at: 0.5, do: 'phone-look' }] } },
          text: [{ say: '* refresh. refresh. refresh. *', style: 'whisper', at: 0.08, place: 'lower' }],
          sound: [{ cue: 'pop', at: 0.1, volume: 0.7 }, { cue: 'pop', at: 0.35, volume: 0.7 }, { cue: 'pop', at: 0.6, volume: 0.7 }],
        },
        {
          id: 'commentary',
          purpose: 'clue',
          duration: 0.85,
          camera: 'over-shoulder:mateo>emre push-in x0.6',
          cast: { emre: { do: { do: 'fake-type', lookAt: 'desk-a-monitor' } } },
          text: [{ say: '“…and he’s through on goal…”', style: 'subtitle', at: 0.08, place: 'lower' }],
          sound: [{ cue: 'typing', duration: 0.85, volume: 0.9 }, { cue: 'crowd-muffled', duration: 0.85, volume: 0.4 }],
        },
        {
          id: 'boss',
          purpose: 'escalation',
          duration: 1.6,
          camera: 'crane-up push-in x0.4',
          cast: {
            boss: { at: 'aisle-back', move: { to: 'aisle-mid', at: 0, duration: 1.6 }, do: { do: 'stroll' } },
            emre: { do: { at: 0.12, do: 'fake-type', lookAt: 'desk-a-monitor' } },
            mateo: { hold: '', do: { at: 0.08, do: 'fake-type', lookAt: 'desk-b-monitor' } },
            giulia: { do: { at: 0.05, do: 'fake-type', lookAt: 'pod-left-a-monitor' } },
            yuki: { do: { at: 0.1, do: 'fake-type', lookAt: 'pod-right-a-monitor' } },
          },
          graphics: [
            { kind: 'screen', at: 0.06, props: { surface: 'pod-left-a-monitor', content: 'spreadsheet' } },
            { kind: 'screen', at: 0.1, props: { surface: 'desk-b-monitor', content: 'spreadsheet' } },
          ],
          text: [{ say: 'the boss.', style: 'whisper', at: 0.15, place: 'lower' }],
          sound: [{ cue: 'hush', at: 0.05, duration: 2.6 }, { cue: 'typing', at: 0.1, duration: 1.5, volume: 1.3 }, { cue: 'footsteps', duration: 1.6, volume: 1.1 }],
        },
        {
          id: 'passes',
          purpose: 'escalation',
          duration: 1.0,
          camera: 'aisle-low',
          cast: {
            boss: { move: { to: 'aisle-front', at: 0, duration: 1.8 }, do: { do: 'stroll' } },
            emre: { lookAt: 'boss' },
            mateo: { lookAt: 'boss' },
          },
          sound: [{ cue: 'typing', duration: 1.0, volume: 1.3 }, { cue: 'footsteps', duration: 1.0, volume: 0.8 }],
        },
        {
          id: 'exhale-a',
          purpose: 'reaction',
          duration: 0.34,
          camera: 'close:yuki right',
          cast: { yuki: { do: { do: 'exhale' } }, emre: { do: { do: 'exhale' } }, mateo: { do: { do: 'exhale' } } },
          sound: [{ cue: 'cloth', volume: 1.2 }],
        },
        {
          id: 'exhale-b',
          purpose: 'reaction',
          duration: 0.34,
          camera: 'close:giulia left',
          cast: { giulia: { do: { do: 'exhale' } } },
          sound: [{ cue: 'cloth', volume: 1.2 }],
        },
        {
          id: 'exhale-c',
          purpose: 'reaction',
          duration: 0.5,
          camera: 'over-shoulder:emre>mateo pull-out x0.5',
          sound: [{ cue: 'cloth', volume: 1.2 }, { cue: 'chair', at: 0.15, volume: 0.7 }],
        },
        {
          id: 'black',
          purpose: 'reveal',
          duration: 0.75,
          camera: 'aisle-dolly',
          cast: { emre: { do: 'freeze' }, mateo: { do: 'freeze' }, giulia: { do: 'freeze' }, yuki: { do: 'freeze' } },
          graphics: [{ kind: 'screen', at: 0.08, props: { content: 'black' } }],
          sound: [{ cue: 'tv-off', at: 0.08, volume: 1.4 }, { cue: 'hush', at: 0.08, duration: 1.8 }],
        },
        {
          id: 'your-match',
          purpose: 'reveal',
          duration: 1.15,
          camera: 'desk-a-screen push-in x0.5',
          cast: { emre: { do: { do: 'notice', lookAt: 'desk-a-monitor' } }, mateo: { do: { do: 'notice', lookAt: 'desk-a-monitor' } } },
          graphics: [{ kind: 'screen', at: 0.15, props: { surface: 'desk-a-monitor', content: 'your-match' } }],
          sound: [{ cue: 'boom', at: 0.15, volume: 0.8 }, { cue: 'notification', at: 0.18, volume: 0.9 }],
        },
        {
          id: 'morph',
          purpose: 'transform',
          duration: 2.3,
          camera: { lens: 'crane-up', move: ['rise', 'push-in'], amount: 0.7 },
          cast: {
            emre: { do: [{ do: 'stand-up', lookAt: 'desk-a-monitor' }, { at: 1.3, do: 'cheer' }] },
            mateo: { do: [{ at: 0.15, do: 'stand-up' }, { at: 1.4, do: 'cheer' }] },
            giulia: { do: [{ at: 0.3, do: 'stand-up' }, { at: 1.5, do: 'cheer' }] },
            yuki: { do: [{ at: 0.25, do: 'stand-up' }, { at: 1.45, do: 'cheer' }] },
          },
          fx: [{ type: 'stadium-morph', at: 0.1, until: 1.9 }],
          sound: [{ cue: 'crowd-opening', duration: 2.3, volume: 1 }, { cue: 'stomp-clap', at: 0.3, duration: 2.0, volume: 0.9 }, { cue: 'riser-long', duration: 1.9, volume: 0.7 }, { cue: 'goal-roar', at: 1.9, volume: 0.7 }],
        },
        {
          id: 'so-do-you',
          purpose: 'payoff',
          duration: 2.0,
          camera: { lens: 'crane-up', move: ['rise'], amount: 0.4 },
          cast: { emre: { do: 'cheer' }, mateo: { do: 'cheer' }, giulia: { do: 'cheer' }, yuki: { do: 'cheer' } },
          text: [{ say: 'everyone has\na match tonight.\nso do you.', style: 'title', at: 0.05, place: 'top' }],
          graphics: [{ kind: 'lockup', at: 0.6, props: { place: 'bottom' } }],
          sound: [{ cue: 'crowd-bed', duration: 2.0, volume: 0.6 }, { cue: 'brand-sting', at: 0.6, volume: 2 }],
        },
      ],
    },
  ],
};
