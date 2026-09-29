import type { ContentSpec } from '../engine/spec/types';

/**
 * DEMO B — "When the group chat becomes real" (phone → match → phone).
 *
 * Mechanic: a screen-recording group chat escalates in real time; the push
 * notification IS the transition — the camera dives through it into the
 * stadium, where the chat avatars are the players. A comedic freeze-frame
 * labels the victim mid-hurdle. Payoff: the goal. Punchline: back in the
 * thread — the replay, "lag.", and a system line.
 */
export const GROUP_CHAT: ContentSpec = {
  id: 'group-chat',
  title: 'The Group Chat',
  logline: 'Trash talk in the group chat → HNC match found → dive through the notification into the stadium.',
  fps: 30,
  seed: 7,
  formats: ['reel', 'portrait', 'square'],
  cast: {
    hero: { country: 'TR', number: 9, name: 'Emre', look: 'hoodie' },
    rival: { country: 'GR', number: 4, name: 'Nikos', look: 'hoodie' },
    friend: { country: 'BR', number: 7, name: 'Caio', look: 'hoodie' },
  },
  keyArt: { thumb: 'freeze@40%', chat: 'challenge@90%' },
  scenes: [
    {
      id: 'chat',
      world: 'phone',
      set: { title: 'the boys ⚽', me: 'hero', members: ['rival', 'friend', 'hero'], time: '23:47', thread: 'boys' },
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.55,
          camera: 'static',
          text: [{ say: 'when the group chat gets personal', style: 'pov', at: 0.1, until: 'challenge.end', place: 'upper' }],
          graphics: [
            { kind: 'chat', at: 0.15, props: { from: 'rival', say: 'türkiye can’t even pass 😂' } },
            { kind: 'chat', at: 0.95, props: { from: 'friend', say: '💀💀💀' } },
          ],
          sound: [{ cue: 'message-in', at: 0.15 }, { cue: 'message-in', at: 0.95 }],
        },
        {
          id: 'reply',
          purpose: 'setup',
          duration: 1.3,
          camera: 'static',
          graphics: [
            { kind: 'chat', at: 0.2, props: { from: 'hero', say: 'say that on the pitch', reply: 'türkiye can’t even pass 😂' } },
            { kind: 'typing', at: 0.75, until: 'end', props: { from: 'rival' } },
          ],
          sound: [{ cue: 'message-out', at: 0.2 }],
        },
        {
          id: 'challenge',
          purpose: 'escalation',
          duration: 1.2,
          camera: 'static',
          graphics: [
            { kind: 'chat', at: 0.05, props: { from: 'rival', say: '1v1. HNC. now.' } },
            { kind: 'chat', at: 0.7, props: { from: 'friend', say: 'OH NO 🍿' } },
          ],
          sound: [{ cue: 'message-in', at: 0.05 }, { cue: 'message-in', at: 0.7 }, { cue: 'tension-rise', at: 0.3, duration: 1.8, volume: 0.9 }],
        },
        {
          id: 'match-found',
          purpose: 'transform',
          duration: 0.95,
          camera: 'static',
          graphics: [{ kind: 'notification', at: 0.05, props: { app: 'HNC League', title: 'Match found ⚽', body: '🇹🇷 Emre vs 🇬🇷 Nikos · tap to play' } }],
          sound: [{ cue: 'notification', at: 0.05, volume: 1.2 }],
        },
      ],
    },
    {
      id: 'pitch',
      world: 'football',
      set: { moment: 'hero-attack', roles: { striker: 'hero', rival: 'rival' } },
      enter: { type: 'zoom-through', from: 'notification', duration: 0.5 },
      beats: [
        {
          id: 'faceoff',
          purpose: 'payoff',
          duration: 1.2,
          clock: { from: 1.3, to: 2.5 },
          camera: 'faceoff-depth-push',
          graphics: [{ kind: 'versus', at: 0.25, until: 'end-2f', props: { home: 'hero', away: 'rival' } }],
          sound: [{ cue: 'stadium-reveal', volume: 0.7 }, { cue: 'whistle', at: 'end-0.1', volume: 1.4 }],
        },
        {
          id: 'burst',
          purpose: 'escalation',
          // Real time: a shorter beat would fast-forward the sprint past 12 m/s (QA).
          duration: 1.05,
          clock: { from: 2.5, to: 3.55 },
          camera: 'runner-burst',
        },
        {
          id: 'freeze',
          purpose: 'punchline',
          // Real speed into the freeze (4.52 at ~1.0s), then a ~0.85s hold to read the label.
          duration: 1.85,
          clock: { from: 3.55, to: 5.4 },
          camera: 'runner-lead',
          freeze: 'moment:4.52',
          fx: [{ type: 'freeze-grade', at: 'moment:4.52' }],
          text: [{ say: '“1v1 me” — Nikos, 4s ago', style: 'label', at: 'moment:4.52+2f', place: 'on:rival' }],
          sound: [{ cue: 'record-scratch', at: 'moment:4.52' }, { cue: 'hush', at: 'moment:4.52', duration: 0.8 }],
        },
        {
          id: 'strike',
          purpose: 'payoff',
          duration: 1.2,
          clock: { from: 5.5, to: 6.5, ramp: 'anticipation-snap' },
          camera: 'striker-windup',
          fx: [
            { type: 'impact-burst', at: 'moment:contact' },
            { type: 'impact-shake', at: 'moment:contact', intensity: 0.9 },
            { type: 'zoom-punch', at: 'moment:contact', intensity: 0.8 },
            { type: 'ball-trail', at: 'moment:contact+1f' },
          ],
        },
        {
          id: 'goal',
          purpose: 'payoff',
          duration: 0.6,
          clock: { from: 6.5, to: 7.05 },
          camera: 'net-reverse',
          fx: [
            { type: 'ball-trail', until: 'moment:netHit+1f' },
            { type: 'impact-shake', at: 'moment:netHit', intensity: 1.3 },
            { type: 'zoom-punch', at: 'moment:netHit' },
          ],
          graphics: [{ kind: 'goal-call', text: 'GOAL!', at: 'moment:netHit', props: { sub: 'EMRE · 1-0' } }],
        },
      ],
      sound: [
        { cue: 'kick', at: 'moment:touch-1', volume: 1.6 },
        { cue: 'kick', at: 'moment:touch-2', volume: 1.6 },
        { cue: 'kick', at: 'moment:touch-3', volume: 1.6 },
        { cue: 'whoosh', at: 'moment:slide', volume: 1.4 },
        { cue: 'shot', at: 'moment:contact', volume: 3 },
        { cue: 'impact', at: 'moment:contact', volume: 3.5 },
        { cue: 'impact', at: 'moment:netHit', volume: 4 },
        { cue: 'goal-sting', at: 'moment:netHit', volume: 2.2 },
        { cue: 'goal-roar', at: 'moment:netHit', volume: 0.8 },
      ],
    },
    {
      id: 'aftermath',
      world: 'phone',
      set: { title: 'the boys ⚽', me: 'hero', members: ['rival', 'friend', 'hero'], time: '23:49', thread: 'boys' },
      enter: { type: 'glitch' },
      beats: [
        {
          id: 'replay',
          purpose: 'punchline',
          duration: 2.3,
          camera: 'static',
          graphics: [
            { kind: 'chat', at: 0.1, props: { from: 'hero', say: 'anyway', image: 'goal' } },
            { kind: 'typing', at: 0.55, until: 1.25, props: { from: 'rival' } },
            { kind: 'chat', at: 1.25, props: { from: 'rival', say: 'lag.' } },
            { kind: 'system-note', at: 1.7, props: { say: 'Nikos left the group' } },
          ],
          sound: [{ cue: 'message-out', at: 0.1 }, { cue: 'message-in', at: 1.25 }, { cue: 'pop', at: 1.7 }],
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
          graphics: [{ kind: 'brand-reveal', props: { words: ['SETTLE', 'THE', 'CHAT.'], site: 'hncleague.com', footer: '1V1 ANY COUNTRY. FREE IN YOUR BROWSER.' } }],
          sound: [{ cue: 'brand-sting', at: 0.4, volume: 3 }],
        },
      ],
    },
  ],
};
