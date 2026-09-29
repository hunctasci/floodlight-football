import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HNC_SIT_DROP } from '@floodlight/hnc-visuals';
import { ACTION_IDS, actionPose } from '../src/cast/actions';
import { LOOKS } from '../src/cast/looks';
import { actorState, headPoint } from '../src/cast/state';
import { CONTENT } from '../src/content';
import { compileContent } from '../src/engine/director/compile';

describe('cast: actions, posture, gaze', () => {
  it('every action yields a finite pose over time, seated and standing', () => {
    for (const id of ACTION_IDS) for (const sit of [0, 1]) for (const t of [0, 0.1, 0.4, 1, 3]) {
      const p = actionPose(id, t, sit);
      assert.ok(Object.values(p).every(Number.isFinite), `${id} sit=${sit} t=${t}`);
    }
  });
  it('stand-up leaves the character standing for later actions', () => {
    const tl = compileContent(CONTENT['office-rivalry']);
    const shot = tl.shots.find((s) => s.beat === 'lights')!;
    const hero = shot.actors.find((a) => a.cast === 'hero')!;
    const st = actorState(shot, hero, shot.start + 5, tl.fps);
    assert.equal(st.pose.sit, 0);
    const hook = tl.shots[0];
    assert.equal(actorState(hook, hook.actors[0], 5, tl.fps).pose.sit, 1, 'desk marks start seated');
  });
  it('a side-eye moves the eyes toward the target far more than the head', () => {
    const tl = compileContent(CONTENT['office-rivalry']);
    const shot = tl.shots.find((s) => s.beat === 'side-eye')!;
    const hero = shot.actors.find((a) => a.cast === 'hero')!;
    const target = () => ({ x: 0.6, y: 0.94, z: -0.6 });
    const st = actorState(shot, hero, shot.start + 30, tl.fps, target);
    assert.ok(Math.abs(st.pose.gazeX) > 0.5, 'eyes slide');
    assert.ok(Math.abs(st.pose.headYaw) < 0.25, 'head barely follows');
  });
  it('seated heads clear the monitors; standing heads are at game height', () => {
    const tl = compileContent(CONTENT['office-rivalry']);
    const hook = tl.shots[0];
    const st = actorState(hook, hook.actors[0], 5, tl.fps);
    const h = headPoint(st.pos, st.facing, st.pose);
    assert.ok(h.y > 1.3 && h.y < 1.7 - HNC_SIT_DROP + 0.1);
  });
  it('every look maps onto a canonical wardrobe', () => {
    for (const [id, l] of Object.entries(LOOKS)) assert.ok(l.wardrobe, id);
  });
});
