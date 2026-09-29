import type { ContentSpec } from '../engine/spec/types';

/**
 * HNC hero trailer (9:16, 60fps, 12s) — the first-generation flagship, now a
 * plain ContentSpec. One continuous `hero-attack` choreography covered by ten
 * shots; clocks chain, cuts land on actions, every effect / graphic / sound is
 * anchored to a choreography beat (`moment:contact`) instead of hand frame
 * math. tests/hero-port.test.ts checks it against the legacy compiled plan.
 */
const touches = [1, 2, 3, 4, 5, 6].map((i) => ({ cue: 'kick', at: `moment:touch-${i}`, volume: 1.6 }));

export const HNC_HERO: ContentSpec = {
  id: 'hnc-hero',
  title: 'HNC Hero Trailer',
  logline: 'Floodlights strike on, one continuous attack, a late winner, the World Table climb.',
  fps: 60,
  seed: 42,
  formats: ['reel'],
  cast: {
    hero: { country: 'TR', number: 9, name: 'Emre' },
    rival: { country: 'GR', number: 4, name: 'Nikos' },
  },
  keyArt: { thumb: 'shot@58%', goal: 'goal@40%' },
  scenes: [
    {
      id: 'attack',
      world: 'football',
      set: { moment: 'hero-attack', roles: { striker: 'hero', rival: 'rival' } },
      ambience: false,
      beats: [
        {
          id: 'hook',
          purpose: 'hook',
          duration: 1.0,
          clock: { from: 0, to: 1 },
          camera: 'ball-rise-reveal',
          fx: [{ type: 'lights-on' }],
          sound: [
            { cue: 'crowd-bed', volume: 0.55 },
            // Floodlight banks striking (LightsOn bank frames 16% / 36% / 56%).
            { cue: 'impact', at: '16%', volume: 3.4 },
            { cue: 'impact', at: '36%', volume: 3.4 },
            { cue: 'impact', at: '56%', volume: 3.4 },
          ],
        },
        { id: 'faceoff', purpose: 'tension', duration: 1.5, clock: { from: 1, to: 2.5 }, camera: 'faceoff-depth-push', fx: [{ type: 'cinebars' }] },
        { id: 'burst', purpose: 'escalation', duration: 1.05, camera: 'runner-burst' },
        { id: 'duel', purpose: 'escalation', duration: 1.2, camera: 'runner-lead' },
        { id: 'approach', purpose: 'escalation', duration: 0.75, camera: 'runner-approach' },
        {
          id: 'shot',
          purpose: 'payoff',
          duration: 1.3,
          clock: { from: 5.5, to: 6.5, ramp: 'anticipation-snap' },
          camera: 'striker-windup',
          fx: [
            { type: 'impact-burst', at: 'moment:contact' },
            { type: 'impact-shake', at: 'moment:contact', intensity: 0.9 },
            { type: 'zoom-punch', at: 'moment:contact', intensity: 0.8 },
            { type: 'ball-trail', at: 'moment:contact+1f' },
          ],
          // Rising "OOOH" (1.85s file) pre-rolls to peak on contact.
          sound: [{ cue: 'crowd-gasp', at: 'moment:contact-1.85', volume: 0.8 }],
        },
        {
          id: 'goal',
          purpose: 'payoff',
          duration: 0.4,
          camera: 'net-reverse',
          fx: [
            { type: 'ball-trail', until: 'moment:netHit+1f' },
            { type: 'impact-shake', at: 'moment:netHit', intensity: 1.3 },
            { type: 'zoom-punch', at: 'moment:netHit' },
          ],
          sound: [{ cue: 'goal-roar', at: 'moment:netHit', volume: 0.8 }],
        },
        { id: 'celebration', purpose: 'reaction', duration: 1.4, camera: 'scorer-push', sound: [{ cue: 'celebration', at: 0.6, volume: 0.4 }] },
        {
          id: 'league',
          purpose: 'proof',
          duration: 1.6,
          camera: 'crane-out',
          fx: [{ type: 'stadium-grade', intensity: 0.9 }],
          graphics: [{ kind: 'world-table', at: '6f', props: { hero: 'hero', rival: 'rival', gain: 3, climbAt: 0.85, exitAt: 'brand', lines: ['YOUR COUNTRY.', 'YOUR LEAGUE.'] } }],
          sound: [{ cue: 'whoosh', at: '6f', volume: 1.2 }],
        },
        {
          id: 'brand',
          purpose: 'brand',
          duration: 1.8,
          camera: 'stadium-drift',
          // Starts "already in" so the grade carries over the cut.
          fx: [{ type: 'stadium-grade', at: -0.4 }],
          graphics: [{ kind: 'brand-reveal', props: { at: 'start-3f', words: ['PLAY.', 'WIN.', 'CLIMB.'], site: 'hncleague.com', footer: 'RETRO FOOTBALL. REAL RIVALRIES.' } }],
          sound: [{ cue: 'brand-sting', at: '15f', volume: 3 }],
        },
      ],
      graphics: [
        { kind: 'eyebrow', text: 'HNC LEAGUE', from: 'hook', to: 'faceoff', at: 'hook@56%', props: { exitAt: 'faceoff+0.75' } },
        { kind: 'scoreboard', from: 'faceoff', to: 'goal', props: { before: [0, 0], after: [1, 0], clock: "2ND 89'", enterAt: 'faceoff+0.3', flipAt: 'moment:netHit' } },
        { kind: 'goal-call', text: 'GOAL!', from: 'goal', to: 'celebration', at: 'moment:netHit', props: { sub: "89' · LATE WINNER", exitAt: 'celebration+0.55' } },
      ],
      sound: [
        ...touches,
        { cue: 'whoosh', at: 'moment:slide', volume: 1.4 },
        { cue: 'whoosh', at: 'moment:3.51', volume: 2 },
        { cue: 'whoosh', at: 'moment:4.71', volume: 2 },
        { cue: 'shot', at: 'moment:contact', volume: 3 },
        { cue: 'impact', at: 'moment:contact', volume: 3.5 },
        { cue: 'whoosh', at: 'moment:goalLine-0.04', volume: 2.2 },
        { cue: 'impact', at: 'moment:netHit', volume: 4 },
        { cue: 'goal-sting', at: 'moment:netHit', volume: 2.2 },
      ],
    },
  ],
};
