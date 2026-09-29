import type { ContentSpec } from '../engine/spec/types';

/**
 * DEMO A — "POV: your new coworker supports Greece" (office → football → office).
 *
 * Hook: a POV caption over an ordinary desk pod. Curiosity: a tiny Greek
 * flag. Escalation: side-eye, a stare back, the whole floor turns, both
 * stand, the lights stutter. Transformation: the fluorescent panel blows out
 * and resolves as a stadium floodlight — same two people, same framing, now
 * in kit. Payoff: the #9 scores. Punchline: back at work, still in the kit.
 */
export const OFFICE_RIVALRY: ContentSpec = {
  id: 'office-rivalry',
  title: 'New Coworker',
  logline: 'POV: your new coworker supports Greece. The office becomes a stadium.',
  fps: 30,
  seed: 42,
  formats: ['reel', 'portrait', 'square'],
  cast: {
    hero: { country: 'TR', number: 9, name: 'Emre' },
    rival: { country: 'GR', number: 4, name: 'Nikos' },
  },
  keyArt: { thumb: 'faceoff@55%', office: 'glare-back@60%' },
  scenes: [
    {
      id: 'office',
      world: 'office',
      set: { clock: '09:03', extras: 5 },
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.35,
          camera: 'over-shoulder:hero>rival push-in handheld x0.6',
          cast: {
            hero: { at: 'desk-a', do: 'typing' },
            rival: { at: 'desk-b', do: 'typing' },
          },
          text: [{ say: 'POV: your new coworker supports Greece', style: 'pov', at: 0.15, until: 'clue.end' }],
          sound: [{ cue: 'typing', duration: 1.35, volume: 0.9 }],
        },
        {
          id: 'clue',
          purpose: 'clue',
          duration: 0.9,
          camera: 'macro:desk-b-flag>rival push-in',
          sound: [{ cue: 'clack', at: 0.05 }, { cue: 'typing', duration: 0.9, volume: 0.5 }],
        },
        {
          id: 'side-eye',
          purpose: 'reaction',
          duration: 1.3,
          camera: 'close:hero push-in x0.5',
          cast: { hero: { do: [{ at: 0.1, do: 'side-eye', lookAt: 'desk-b-flag' }] } },
          text: [{ say: '* slow side-eye *', style: 'whisper', at: 0.35, place: 'lower' }],
          sound: [{ cue: 'record-scratch', at: 0.08 }, { cue: 'hush', at: 0.08, duration: 1.1 }],
        },
        {
          id: 'glare-back',
          purpose: 'tension',
          duration: 1.0,
          camera: 'over-shoulder:hero>rival push-in',
          cast: { rival: { do: [{ at: 0.15, do: 'notice', lookAt: 'hero' }, { at: 0.55, do: 'glare', lookAt: 'hero' }] } },
          sound: [{ cue: 'tension-rise', at: 0.2, duration: 2.3, volume: 1.1 }],
        },
        {
          id: 'hero-glare',
          purpose: 'escalation',
          duration: 0.5,
          camera: 'close:hero crash-zoom',
          cast: { hero: { do: { do: 'glare', lookAt: 'rival' } } },
          fx: [{ type: 'coworkers-look' }, { type: 'rival-grade', intensity: 0.6 }],
          sound: [{ cue: 'heartbeat', volume: 1.2 }],
        },
        {
          id: 'rival-glare',
          purpose: 'escalation',
          duration: 0.5,
          camera: 'close:rival crash-zoom',
          fx: [{ type: 'coworkers-look', at: -0.5 }, { type: 'rival-grade', intensity: 0.8 }],
          sound: [{ cue: 'heartbeat', volume: 1.2 }],
        },
        {
          id: 'stand-off',
          purpose: 'escalation',
          duration: 0.9,
          camera: 'two-shot:hero>rival rise',
          cast: {
            hero: { do: [{ do: 'stand-up', lookAt: 'rival' }, { at: 0.6, do: 'stare-down', lookAt: 'rival' }] },
            rival: { do: [{ at: 0.05, do: 'stand-up', lookAt: 'hero' }, { at: 0.65, do: 'stare-down', lookAt: 'hero' }] },
          },
          fx: [{ type: 'coworkers-look', at: -1.0 }, { type: 'lights-flicker', at: 0.35 }],
          sound: [{ cue: 'chair', at: 0.05 }, { cue: 'flicker', at: 0.35 }],
        },
        {
          id: 'lights',
          purpose: 'transform',
          duration: 0.75,
          camera: { lens: 'over-shoulder', on: 'hero', at: 'rival', move: ['tilt-to:ceiling-light'], ease: 'ease-in' },
          fx: [{ type: 'coworkers-look', at: -1.9 }, { type: 'lights-flicker', until: 0.3 }, { type: 'lights-surge', at: 0.3 }],
          sound: [{ cue: 'buzz', duration: 0.75, volume: 0.8 }],
        },
      ],
    },
    {
      id: 'match',
      world: 'football',
      set: { moment: 'hero-attack', roles: { striker: 'hero', rival: 'rival' } },
      enter: { type: 'light-bloom', from: 'ceiling-light', to: 'floodlight', duration: 0.5 },
      beats: [
        {
          id: 'faceoff',
          purpose: 'transform',
          duration: 1.35,
          clock: { from: 1.15, to: 2.5 },
          camera: { lens: 'faceoff-depth-push', move: ['tilt-from:floodlight'], ease: 'ease-in-out' },
          text: [{ say: 'EMRE · #9', style: 'label', at: 0.55, place: 'on:hero' }],
          sound: [{ cue: 'stadium-reveal', volume: 0.7 }],
        },
        { id: 'burst', purpose: 'escalation', duration: 0.95, clock: { from: 2.5, to: 3.55 }, camera: 'runner-burst' },
        {
          id: 'strike',
          purpose: 'payoff',
          duration: 1.3,
          clock: { from: 5.5, to: 6.5, ramp: 'anticipation-snap' },
          camera: 'striker-windup',
          enter: { type: 'flash', duration: 0.12 },
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
          fx: [
            { type: 'ball-trail', until: 'moment:netHit+1f' },
            { type: 'impact-shake', at: 'moment:netHit', intensity: 1.3 },
            { type: 'zoom-punch', at: 'moment:netHit' },
          ],
        },
        { id: 'scorer', purpose: 'reaction', duration: 0.9, clock: { from: 6.9, to: 7.8 }, camera: 'scorer-push', sound: [{ cue: 'celebration', at: 0.4, volume: 0.4 }] },
      ],
      graphics: [{ kind: 'goal-call', text: 'GOAL!', from: 'goal', to: 'scorer', at: 'moment:netHit', props: { sub: 'EMRE · #9', exitAt: 'scorer+0.6' } }],
      sound: [
        { cue: 'kick', at: 'moment:touch-1', volume: 1.6 },
        { cue: 'kick', at: 'moment:touch-2', volume: 1.6 },
        { cue: 'whoosh', at: 'moment:3.45', volume: 1.6 },
        { cue: 'shot', at: 'moment:contact', volume: 3 },
        { cue: 'impact', at: 'moment:contact', volume: 3.5 },
        { cue: 'whoosh', at: 'moment:goalLine-0.04', volume: 2.2 },
        { cue: 'impact', at: 'moment:netHit', volume: 4 },
        { cue: 'goal-sting', at: 'moment:netHit', volume: 2.2 },
        { cue: 'goal-roar', at: 'moment:netHit', volume: 0.8 },
      ],
    },
    {
      id: 'monday',
      world: 'office',
      set: { clock: '09:04', extras: 5 },
      looks: { hero: 'kit' },
      enter: { type: 'whip-pan', direction: 'left' },
      beats: [
        {
          id: 'still-in-kit',
          purpose: 'punchline',
          duration: 1.7,
          camera: 'over-shoulder:rival>hero push-in',
          cast: {
            hero: { at: 'desk-a', hold: 'mug', do: [{ do: 'smug', lookAt: 'rival' }, { at: 0.8, do: 'sip', lookAt: 'rival' }] },
            rival: { at: 'desk-b', do: { do: 'deflate' } },
          },
          text: [{ say: 'he wears it to work now', style: 'caption', at: 0.2 }],
          sound: [{ cue: 'typing', at: 0.2, duration: 1.4, volume: 0.35 }],
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
          graphics: [{ kind: 'brand-reveal', props: { words: ['SETTLE', 'IT ON THE', 'PITCH.'], site: 'hncleague.com', footer: 'PICK YOUR COUNTRY. PLAY FREE.' } }],
          sound: [{ cue: 'brand-sting', at: 0.5, volume: 3 }],
        },
      ],
    },
  ],
};
