import type { ContentSpec } from '../../engine/spec/types';

/**
 * EP01's phone moments, rendered by the Reel Factory's phone world (the same
 * native-looking chat as our best-performing reel, `content/group-chat.ts`)
 * inside the Diaries edit. Every Player Diaries episode opens on #9's phone
 * and ends on one new message that teases the next episode.
 *
 * Contacts are saved the Turkish way (Annem = my mum, Oğlum = my son,
 * Aşkım = my love); #9 is `me`, so his name never appears. The chat asks the
 * episode's question ("are you nervous??" — "no." — his son: "he is") and plants
 * its payoffs: the unsent "ask belgium." (S11 tunnel) and the salt (S08).
 */
const CAST: ContentSpec['cast'] = {
  me: { country: 'TR', number: 9, name: 'me', look: 'tee' },
  mum: { country: 'TR', number: 13, name: 'Annem', look: 'tee', accent: '#b5523b' },
  kid: { country: 'TR', number: 5, name: 'Oğlum', look: 'kit' },
  partner: { country: 'TR', number: 6, name: 'Aşkım', look: 'tee', accent: '#8fa98a' },
  coach: { country: 'TR', number: 60, name: 'Coach', look: 'manager' },
};

/**
 * S00_SH01 — 6.4 s: the question the whole episode answers. Mum asks if he's nervous; he types
 * "ask belgium.", deletes it, sends "no."; the partner is out of salt; his son answers for him.
 */
export const EP01_CHAT_OPEN: ContentSpec = {
  id: 'diaries-ep01-chat-open',
  title: 'EP01 · family chat',
  fps: 60,
  seed: 46,
  cast: CAST,
  scenes: [
    {
      id: 'family',
      world: 'phone',
      set: { title: 'Aile ❤️', me: 'me', members: ['mum', 'partner', 'kid'], time: '06:46', thread: 'family' },
      beats: [
        {
          id: 'family',
          purpose: 'hook',
          duration: 6.4,
          camera: 'static',
          graphics: [
            { kind: 'chat', at: 0.25, props: { from: 'mum', say: 'they said on tv you look tired 😟' } },
            { kind: 'chat', at: 1.05, props: { from: 'mum', say: 'are you nervous??' } },
            // the reply he doesn't send — he says it out loud in the tunnel (S11)
            { kind: 'draft', at: 1.75, until: 3.55, props: { say: 'ask belgium.', cps: 0.075, erase: 0.4 } },
            { kind: 'chat', at: 3.75, props: { from: 'me', say: 'no.' } },
            { kind: 'chat', at: 4.45, props: { from: 'partner', say: 'we’re out of salt' } },
            { kind: 'typing', at: 4.95, until: 5.45, props: { from: 'kid' } },
            { kind: 'chat', at: 5.45, props: { from: 'kid', say: 'he is' } },
          ],
        },
      ],
    },
  ],
};

/** S12_SH01 — after the end card: one new message teases EP02. */
// PLACEHOLDER COPY — replace when the EP02 premise is set.
export const EP01_CHAT_TEASER: ContentSpec = {
  id: 'diaries-ep01-chat-teaser',
  title: 'EP01 · EP02 teaser',
  fps: 60,
  seed: 47,
  cast: CAST,
  scenes: [
    {
      id: 'coach',
      world: 'phone',
      set: { title: 'Coach', me: 'me', members: ['coach'], time: '23:58', thread: 'coach' },
      beats: [
        {
          id: 'teaser',
          purpose: 'punchline',
          duration: 2.6,
          camera: 'static',
          graphics: [{ kind: 'chat', at: 0.35, props: { from: 'coach', say: 'my office. 8am.' } }],
        },
      ],
    },
  ],
};
