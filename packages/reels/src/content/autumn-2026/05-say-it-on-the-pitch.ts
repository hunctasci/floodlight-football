import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 05 — SAY IT ON THE PITCH (European week, 20–21 Oct).
 *
 * A country-rivalry group chat in an original messenger skin: easy win / 😂 /
 * you sure? / 🇬🇷🇬🇷🇬🇷 / typing… typing… / "1v1 then." Silence. The phone
 * buzzes, and that bubble grows until it is the whole frame — we land on a
 * cyclorama where the chat is a phone the size of a building, and the two of
 * them step out of its glass to face each other. A fast match. Back in the
 * thread: "best of 3?"
 */
const chat = [
  { from: 'nikos', say: 'easy win' },
  { from: 'emre', say: '😂' },
  { from: 'emre', say: 'you sure?' },
  { from: 'nikos', say: '🇬🇷🇬🇷🇬🇷' },
  { from: 'emre', say: '1v1 then.' },
];

export const SAY_IT: ContentSpec = {
  id: 'autumn-05-say-it',
  title: 'Say It On The Pitch',
  logline: 'The group chat escalates. "1v1 then." The bubble becomes a stadium.',
  fps: 60,
  seed: 505,
  formats: ['reel'],
  cast: { emre: { person: 'emre', look: 'hoodie' }, nikos: { person: 'nikos', look: 'hoodie' } },
  keyArt: { thumb: 'step-out@80%' },
  scenes: [
    {
      id: 'chat',
      world: 'phone',
      set: { skin: 'hnc', title: '🇹🇷 vs 🇬🇷 · no mercy', me: 'emre', members: ['nikos', 'emre'], time: '23:41', thread: 'rivals' },
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.2,
          camera: 'static',
          graphics: [
            { kind: 'chat', at: 0, props: { from: 'nikos', say: 'big night tonight 👀', history: true } },
            { kind: 'chat', at: 0, props: { from: 'emre', say: 'we’re ready', history: true } },
            { kind: 'chat', at: 0.12, props: { from: 'nikos', say: 'easy win' } },
            { kind: 'chat', at: 0.7, props: { from: 'emre', say: '😂' } },
          ],
          text: [{ say: 'european week in the group chat', style: 'pov', at: 0, until: 'escalate.end', place: 'upper' }],
          sound: [{ cue: 'message-in', at: 0.12 }, { cue: 'message-out', at: 0.7 }],
        },
        {
          id: 'escalate',
          purpose: 'escalation',
          duration: 1.2,
          camera: 'static',
          graphics: [
            { kind: 'chat', at: 0.1, props: { from: 'emre', say: 'you sure?' } },
            { kind: 'chat', at: 0.7, props: { from: 'nikos', say: '🇬🇷🇬🇷🇬🇷' } },
          ],
          sound: [{ cue: 'message-out', at: 0.1 }, { cue: 'message-in', at: 0.7 }],
        },
        {
          id: 'typing',
          purpose: 'tension',
          duration: 1.7,
          camera: 'static',
          graphics: [
            { kind: 'typing', at: 0.05, until: 0.5, props: { from: 'nikos' } },
            { kind: 'typing', at: 0.62, until: 0.95, props: { from: 'nikos' } },
            { kind: 'typing', at: 1.05, until: 1.7, props: { from: 'emre' } },
          ],
          sound: [{ cue: 'tick', at: 0.3 }, { cue: 'tick', at: 0.75 }, { cue: 'tick', at: 1.2 }, { cue: 'tick', at: 1.5 }],
        },
        {
          id: 'send',
          purpose: 'reveal',
          duration: 0.85,
          camera: 'static',
          graphics: [{ kind: 'chat', at: 0.05, props: { from: 'emre', say: '1v1 then.' } }],
          sound: [{ cue: 'message-out', at: 0.05, volume: 1.2 }, { cue: 'hush', at: 0.15, duration: 1.3 }],
        },
        {
          id: 'buzz',
          purpose: 'tension',
          duration: 0.6,
          camera: 'static',
          fx: [{ type: 'buzz-shake', at: 0.05, until: 0.55 }],
          sound: [{ cue: 'phone-buzz', at: 0.05, volume: 1.4 }],
        },
      ],
    },
    {
      id: 'giant',
      world: 'stage',
      set: { object: 'phone', chat, me: 'emre', title: '🇹🇷 vs 🇬🇷 · no mercy', tone: 'navy' },
      enter: { type: 'zoom-through', from: 'last-bubble', duration: 0.5 },
      beats: [
        {
          id: 'step-out',
          purpose: 'transform',
          duration: 2.3,
          camera: { lens: 'bubble-close', to: 'reveal', ease: 'ease-in-out' },
          cast: {
            emre: { at: 'in-right', move: { to: 'out-right', at: 0.55, duration: 1.3 }, do: [{ do: 'walk' }, { at: 1.85, do: 'stare-down', lookAt: 'nikos' }] },
            nikos: { at: 'in-left', move: { to: 'out-left', at: 0.62, duration: 1.3 }, do: [{ do: 'walk' }, { at: 1.92, do: 'stare-down', lookAt: 'emre' }] },
          },
          text: [{ say: 'say it on the pitch.', style: 'title', at: 1.3, until: 'faceoff@60%', place: 'top' }],
          sound: [{ cue: 'boom', at: 0.1, volume: 0.9 }, { cue: 'footsteps', at: 0.55, duration: 1.3, volume: 0.7 }, { cue: 'tension-rise', at: 0.9, duration: 1.4, volume: 0.8 }],
        },
      ],
    },
    {
      id: 'match',
      world: 'football',
      set: { moment: 'hero-attack', roles: { striker: 'emre', rival: 'nikos' }, light: 'night' },
      enter: { type: 'flash', duration: 0.18 },
      looks: { emre: 'kit', nikos: 'kit' },
      beats: [
        { id: 'faceoff', purpose: 'tension', duration: 0.8, clock: { from: 1.7, to: 2.5 }, camera: 'faceoff-depth-push', sound: [{ cue: 'stadium-reveal', volume: 0.8 }, { cue: 'whistle', at: 0.75, volume: 1.2 }] },
        { id: 'burst', purpose: 'escalation', duration: 0.7, clock: { from: 2.5, to: 3.2 }, camera: 'runner-burst' },
        {
          id: 'strike',
          purpose: 'payoff',
          duration: 1.2,
          clock: { from: 5.5, to: 6.5, ramp: 'anticipation-snap' },
          camera: 'striker-windup',
          enter: { type: 'whip-pan', direction: 'right' },
          fx: [{ type: 'impact-burst', at: 'moment:contact' }, { type: 'impact-shake', at: 'moment:contact', intensity: 0.9 }, { type: 'zoom-punch', at: 'moment:contact', intensity: 0.8 }, { type: 'ball-trail', at: 'moment:contact+1f' }],
          sound: [{ cue: 'crowd-gasp', at: 'moment:contact-1.2', volume: 0.7 }],
        },
        { id: 'goal', purpose: 'payoff', duration: 0.45, clock: { from: 6.5, to: 6.9 }, camera: 'net-reverse', fx: [{ type: 'ball-trail', until: 'moment:netHit+1f' }, { type: 'impact-shake', at: 'moment:netHit', intensity: 1.3 }, { type: 'zoom-punch', at: 'moment:netHit' }] },
        { id: 'scorer', purpose: 'reaction', duration: 0.6, clock: { from: 6.9, to: 7.5 }, camera: 'scorer-push' },
      ],
      graphics: [{ kind: 'goal-call', text: 'GOAL!', from: 'goal', to: 'scorer', at: 'moment:netHit', props: { sub: 'EMRE · #9', exitAt: 'scorer+0.45' } }],
      sound: [
        { cue: 'shot', at: 'moment:contact', volume: 3 },
        { cue: 'impact', at: 'moment:contact', volume: 3.5 },
        { cue: 'impact', at: 'moment:netHit', volume: 4 },
        { cue: 'goal-sting', at: 'moment:netHit', volume: 2.2 },
        { cue: 'goal-roar', at: 'moment:netHit', volume: 0.8 },
      ],
    },
    {
      id: 'again',
      world: 'phone',
      set: { skin: 'hnc', title: '🇹🇷 vs 🇬🇷 · no mercy', me: 'emre', members: ['nikos', 'emre'], time: '23:44', thread: 'rivals' },
      enter: { type: 'whip-pan', direction: 'left' },
      beats: [
        {
          id: 'best-of-3',
          purpose: 'punchline',
          duration: 1.9,
          camera: 'static',
          graphics: [
            { kind: 'chat', at: 0.35, props: { from: 'nikos', say: 'best of 3?' } },
            { kind: 'lockup', at: 0.9, props: { place: 'top', line: 'SAY IT ON THE PITCH.' } },
          ],
          sound: [{ cue: 'message-in', at: 0.35, volume: 1.2 }, { cue: 'brand-sting', at: 0.95, volume: 1.6 }],
        },
      ],
    },
  ],
};
