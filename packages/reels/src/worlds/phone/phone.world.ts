import type { WorldDef } from '../types';

/**
 * phone — a full-screen messaging app (screen-recording style). The thread is
 * built from the scene's `chat` / `typing` graphics, so messages are timed
 * like any other graphic and stack up across beats. `notification` graphics
 * drop in as a push banner (zoom-through target: surface `notification`).
 */
export const PHONE_WORLD: WorldDef = {
  id: 'phone',
  kind: '2d',
  summary: 'Messaging app: group chat thread with HNC-character avatars, typing dots, push notification banner.',
  params: {
    title: 'Chat name (e.g. "the boys ⚽")',
    me: 'Cast id whose messages are sent (right side)',
    members: 'Cast ids in the chat header',
    time: 'Status-bar clock (default "23:47")',
    thread: 'Thread id shared by phone scenes that continue one chat (default: scene id)',
    skin: 'default | hnc (original navy/gold messenger skin)',
  },
  marks: {},
  props: {},
  lights: {},
  surfaces: {},
  ambience: 'room-tone',
  effects: ['buzz-shake'],
  lensIds: [],
  surfaceRect(id, _shot, _frame, height) {
    if (id === 'notification') return { x: 40, y: Math.round(height * 0.085), w: 1000, h: 190 };
    if (id === 'screen') return { x: 0, y: 0, w: 1080, h: height };
    // The newest message when it is a short one of mine (bottom-right, one line):
    // zoom-through target for "the bubble grows out of the display".
    if (id === 'last-bubble') return { x: 640, y: height - 150 - 24 - 144, w: 404, h: 124 };
    return undefined;
  },
};
