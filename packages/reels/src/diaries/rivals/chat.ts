import type { ContentSpec } from '../../engine/spec/types';

/**
 * "One Goal Between Us" — the phone moments. The hook is a DM from the rival the
 * night before (the native chat format our best reel opened on); the teaser is
 * the next one, pointing at the real return match (Türkiye–Belgium, 12 Nov 2026).
 * #9 is `me`; Lucas is the campaign's Belgium #4 (cast/people.ts).
 */
const CAST: ContentSpec['cast'] = {
  me: { country: 'TR', number: 9, name: 'me', look: 'tee' },
  lucas: { person: 'lucas', look: 'kit' },
};

const DM = { title: 'Lucas 🇧🇪', me: 'me', members: ['lucas'], thread: 'dm' };

/** S00_SH01 — 6.2 s, Thursday 23:12: the all-time score, and the one match they don't talk about. */
export const RIVALS_CHAT_OPEN: ContentSpec = {
  id: 'diaries-rivals-chat-open',
  title: 'Rivals · the DM',
  fps: 30, // the rivals edit runs at 30 fps: the chat clock must match
  seed: 412,
  cast: CAST,
  scenes: [
    {
      id: 'dm',
      world: 'phone',
      set: { ...DM, time: '23:12' },
      beats: [
        {
          id: 'dm',
          purpose: 'hook',
          duration: 6.2,
          camera: 'static',
          graphics: [
            { kind: 'chat', at: 0.25, props: { from: 'lucas', say: '18–17 🇧🇪' } },
            { kind: 'chat', at: 1.0, props: { from: 'me', say: 'all-time goals. yes. i know.' } },
            { kind: 'chat', at: 1.75, props: { from: 'lucas', say: 'just reminding you' } },
            { kind: 'chat', at: 2.55, props: { from: 'me', say: 'brussels. 2000.' } },
            { kind: 'typing', at: 3.1, until: 3.85, props: { from: 'lucas' } },
            { kind: 'chat', at: 3.85, props: { from: 'lucas', say: 'we don’t talk about 2000' } },
            { kind: 'chat', at: 4.85, props: { from: 'me', say: 'see you in liège 🙂' } },
          ],
        },
      ],
    },
  ],
};

/** S12_SH01 — after the end card: the return match is the next episode. */
export const RIVALS_CHAT_TEASER: ContentSpec = {
  id: 'diaries-rivals-chat-teaser',
  title: 'Rivals · see you in november',
  fps: 30, // the rivals edit runs at 30 fps: the chat clock must match
  seed: 413,
  cast: CAST,
  scenes: [
    {
      id: 'dm',
      world: 'phone',
      set: { ...DM, time: '23:58' },
      beats: [
        {
          id: 'teaser',
          purpose: 'punchline',
          duration: 2.6,
          camera: 'static',
          graphics: [{ kind: 'chat', at: 0.35, props: { from: 'lucas', say: 'see you 12 november 🙂' } }],
        },
      ],
    },
  ],
};
