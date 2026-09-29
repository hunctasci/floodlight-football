import type { ContentSpec } from '../../engine/spec/types';

/**
 * AUTUMN 2026 · 02 — THE COFFEE MACHINE INCIDENT (Belgium vs Türkiye, 2 Oct).
 *
 * Hook: a perfectly symmetrical office kitchen; two coworkers walk in from
 * opposite sides toward the one cup on the counter. Curiosity: both hands
 * land on it. Escalation: over-the-shoulder stares, flag badges, coworkers
 * quietly leave, the machine hisses like a film score. Surprise: the lights
 * stutter and, in the dark frames, they are already in kit. Transform: the
 * cup falls — MATCH CUT on the impact — the ball lands between them under
 * floodlights. Payoff: Emre scores. Punchline: back in the kitchen, he
 * calmly takes the coffee; Lucas nods. Next time. (Callback: 09 The Rematch.)
 */
const office = { emre: { person: 'emre' }, lucas: { person: 'lucas' }, giulia: { person: 'giulia' }, mateo: { person: 'mateo' }, yuki: { person: 'yuki' } };

export const COFFEE_MACHINE: ContentSpec = {
  id: 'autumn-02-coffee-machine',
  title: 'The Coffee Machine Incident',
  logline: 'One coffee left. Belgium vs Türkiye day. The office kitchen becomes a stadium.',
  fps: 60,
  seed: 202,
  formats: ['reel'],
  cast: office,
  keyArt: { thumb: 'flicker@40%' },
  scenes: [
    {
      id: 'kitchen',
      world: 'breakroom',
      set: { display: 'machine-ready', flickerLook: 'kit', sign: ['PLEASE WASH', 'YOUR MUG ♥'] },
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.3,
          camera: { lens: 'symmetry', move: ['push-in'], amount: 0.35 },
          cast: {
            emre: { at: 'walk-left', move: { to: 'cup-left', at: 0, duration: 1.05 }, do: [{ do: 'walk' }, { at: 1.05, do: 'idle', lookAt: 'cup' }] },
            lucas: { at: 'walk-right', move: { to: 'cup-right', at: 0, duration: 1.05 }, do: [{ do: 'walk' }, { at: 1.05, do: 'idle', lookAt: 'cup' }] },
            giulia: { at: 'table-a', do: { do: 'idle', lookAt: 'emre' } },
            mateo: { at: 'table-b', do: { do: 'idle', lookAt: 'lucas' } },
          },
          text: [
            { say: 'Belgium vs Türkiye · matchday', style: 'kicker', at: 0.05, until: 'reach.end', place: 'top' },
            { say: 'one coffee left.', style: 'pov', at: 0.2, until: 'reach.end', place: 'upper' },
          ],
          sound: [{ cue: 'footsteps', duration: 1.1, volume: 0.9 }, { cue: 'footsteps', at: 0.26, duration: 0.9, volume: 0.7 }],
        },
        {
          id: 'reach',
          purpose: 'setup',
          duration: 0.85,
          camera: 'cup-overhead push-in x0.4',
          cast: {
            emre: { do: { at: 0.02, do: 'reach-right', lookAt: 'cup' } },
            lucas: { do: { at: 0.05, do: 'reach-left', lookAt: 'cup' } },
          },
          sound: [{ cue: 'cloth', at: 0.02 }, { cue: 'cloth', at: 0.06, volume: 0.7 }, { cue: 'hush', at: 0.4, duration: 1.7 }],
        },
        {
          id: 'stare-a',
          purpose: 'tension',
          duration: 0.65,
          camera: 'standoff-left push-in x0.5',
          cast: { emre: { lookAt: 'lucas' } },
          sound: [{ cue: 'heartbeat', at: 0.05, volume: 0.9 }],
        },
        {
          id: 'stare-b',
          purpose: 'tension',
          duration: 0.65,
          camera: 'standoff-right push-in x0.5',
          cast: { lucas: { lookAt: 'emre' } },
        },
        {
          id: 'leave',
          purpose: 'escalation',
          duration: 0.85,
          camera: 'exit-view drift-left x0.5',
          cast: {
            giulia: { move: { to: 'door', at: 0.05, duration: 1.2 }, do: [{ do: 'walk-slow' }] },
            mateo: { move: { to: 'door', at: 0.18, duration: 1.3 }, do: [{ do: 'walk-slow' }] },
          },
          text: [{ say: '* everyone leaves *', style: 'whisper', at: 0.1, until: 'machine@45%', place: 'lower' }],
        },
        {
          id: 'machine',
          purpose: 'escalation',
          duration: 0.8,
          camera: 'macro:machine push-in',
          cast: { emre: { lookAt: 'machine' }, lucas: { lookAt: 'machine' } },
          fx: [{ type: 'machine-brew', at: 0.05, until: 'end' }],
          sound: [{ cue: 'machine-hiss', at: 0.02, volume: 1.2 }, { cue: 'dramatic-sting', at: 0.02, volume: 1.1 }],
        },
        {
          id: 'slide',
          purpose: 'escalation',
          duration: 0.75,
          camera: 'cup-overhead push-in x0.6',
          cast: { emre: { do: { at: 0.06, do: 'pull-right', lookAt: 'lucas' } }, lucas: { lookAt: 'cup' } },
          fx: [{ type: 'cup-slide', at: 0.1, until: 0.7, intensity: -1 }],
          sound: [{ cue: 'cup-scrape', at: 0.1, volume: 1.2 }],
        },
        {
          id: 'saw-that',
          purpose: 'reaction',
          duration: 0.65,
          camera: 'standoff-right push-in x1.2',
          cast: { lucas: { do: { do: 'glare', lookAt: 'emre' } } },
          text: [{ say: '* he saw that *', style: 'whisper', at: 0.08, until: 'flicker@35%', place: 'lower' }],
          sound: [{ cue: 'tension-rise', at: 0.1, duration: 1.6, volume: 1.1 }],
        },
        {
          id: 'flicker',
          purpose: 'transform',
          duration: 0.85,
          camera: { lens: 'symmetry', move: ['push-in'], amount: 1.2, ease: 'ease-in' },
          cast: { emre: { do: { do: 'glare', lookAt: 'lucas' } } },
          fx: [{ type: 'lights-flicker', at: 0, until: 'end' }, { type: 'cup-tip', at: 0.5 }],
          sound: [{ cue: 'flicker', at: 0, volume: 1.2 }, { cue: 'buzz', duration: 0.85, volume: 0.8 }],
        },
        {
          id: 'fall',
          purpose: 'transform',
          duration: 0.35,
          camera: 'floor-low',
          sound: [{ cue: 'hush', at: 0, duration: 0.35 }, { cue: 'whoosh', at: 0.1, volume: 0.8 }],
        },
      ],
    },
    {
      id: 'pitch',
      world: 'football',
      set: { moment: 'hero-attack', roles: { striker: 'emre', rival: 'lucas' }, light: 'night', dropBall: 1.3 },
      enter: { type: 'match-cut' },
      beats: [
        {
          id: 'land',
          purpose: 'reveal',
          duration: 0.5,
          clock: { from: 1.29, to: 1.79 },
          camera: 'ball-hero-low',
          fx: [{ type: 'flash', at: 0, intensity: 0.55 }, { type: 'impact-shake', at: 0, intensity: 0.6 }],
          sound: [{ cue: 'cup-hit', at: 0, volume: 1.1 }, { cue: 'ball-land', at: 0, volume: 1.6 }, { cue: 'impact', at: 0, volume: 2.6 }, { cue: 'stadium-reveal', at: 0, volume: 0.8 }],
        },
        {
          id: 'faceoff',
          purpose: 'tension',
          duration: 0.75,
          clock: { from: 1.79, to: 2.54 },
          camera: 'faceoff-depth-push',
          text: [{ say: 'EMRE · #9', style: 'label', at: 0.12, place: 'on:emre' }],
        },
        {
          id: 'strike',
          purpose: 'payoff',
          duration: 1.2,
          clock: { from: 5.5, to: 6.5, ramp: 'anticipation-snap' },
          camera: 'striker-windup',
          enter: { type: 'whip-pan', direction: 'right' },
          fx: [
            { type: 'impact-burst', at: 'moment:contact' },
            { type: 'impact-shake', at: 'moment:contact', intensity: 0.9 },
            { type: 'zoom-punch', at: 'moment:contact', intensity: 0.8 },
            { type: 'ball-trail', at: 'moment:contact+1f' },
          ],
          sound: [{ cue: 'crowd-gasp', at: 'moment:contact-1.2', volume: 0.7 }],
        },
        {
          id: 'goal',
          purpose: 'payoff',
          duration: 0.45,
          clock: { from: 6.5, to: 6.9 },
          camera: 'net-reverse',
          fx: [{ type: 'ball-trail', until: 'moment:netHit+1f' }, { type: 'impact-shake', at: 'moment:netHit', intensity: 1.3 }, { type: 'zoom-punch', at: 'moment:netHit' }],
        },
        { id: 'scorer', purpose: 'reaction', duration: 0.7, clock: { from: 6.9, to: 7.6 }, camera: 'scorer-push', sound: [{ cue: 'celebration', at: 0.3, volume: 0.45 }] },
      ],
      graphics: [{ kind: 'goal-call', text: 'GOAL!', from: 'goal', to: 'scorer', at: 'moment:netHit', props: { sub: 'EMRE · #9', exitAt: 'scorer+0.5' } }],
      sound: [
        { cue: 'shot', at: 'moment:contact', volume: 3 },
        { cue: 'impact', at: 'moment:contact', volume: 3.5 },
        { cue: 'whoosh', at: 'moment:goalLine-0.04', volume: 2.2 },
        { cue: 'impact', at: 'moment:netHit', volume: 4 },
        { cue: 'goal-sting', at: 'moment:netHit', volume: 2.2 },
        { cue: 'goal-roar', at: 'moment:netHit', volume: 0.8 },
      ],
    },
    {
      id: 'after',
      world: 'breakroom',
      set: { display: 'machine-out', sign: ['PLEASE WASH', 'YOUR MUG ♥'] },
      enter: { type: 'whip-pan', direction: 'left' },
      beats: [
        {
          id: 'take',
          purpose: 'punchline',
          duration: 0.55,
          camera: 'cup-overhead',
          cast: {
            emre: { at: 'cup-left', do: [{ do: 'reach-right', lookAt: 'cup' }] },
            lucas: { at: 'cup-right', do: { do: 'idle', lookAt: 'emre' } },
          },
          fx: [{ type: 'cup-take', at: 0.45 }],
          sound: [{ cue: 'cup-set', at: 0.42, volume: 0.8 }],
        },
        {
          id: 'sip',
          purpose: 'punchline',
          duration: 2.1,
          camera: { lens: 'symmetry', move: ['pull-out'], amount: 0.5 },
          cast: {
            emre: { hold: 'paper-cup', do: [{ do: 'sip', lookAt: 'lucas' }, { at: 1.3, do: 'smug', lookAt: 'lucas' }] },
            lucas: { do: [{ at: 0.4, do: 'nod', lookAt: 'emre' }] },
          },
          text: [{ say: 'this was never\nabout coffee.', style: 'title', at: 0.35, place: 'top' }],
          graphics: [{ kind: 'lockup', at: 0.9, props: { place: 'bottom' } }],
          sound: [{ cue: 'sip', at: 0.3, volume: 1.1 }, { cue: 'machine-beep', at: 1.0, volume: 0.6 }, { cue: 'brand-sting', at: 0.95, volume: 2.2 }],
        },
      ],
    },
  ],
};
