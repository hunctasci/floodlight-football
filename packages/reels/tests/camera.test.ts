import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shotLens } from '../src/camera/evaluate';
import { normalizeCamera } from '../src/camera/intent';
import { finiteLens } from '../src/camera/vec';
import { CONTENT } from '../src/content';
import { compileContent } from '../src/engine/director/compile';
import { fitVerticalFov } from '../src/engine/formats';

describe('camera', () => {
  it('parses the compact intent spelling', () => {
    assert.deepEqual(normalizeCamera('over-shoulder:hero>rival push-in handheld x0.6 right'), {
      lens: 'over-shoulder', on: 'hero', at: 'rival', move: ['push-in', 'handheld'], amount: 0.6, ease: 'ease-in-out', side: 'right',
    });
  });
  it('other formats keep the 9:16 horizontal field of view (centred crop)', () => {
    const h = (fov: number, aspect: number) => 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
    for (const aspect of [1080 / 1350, 1]) assert.ok(Math.abs(h(fitVerticalFov(40, aspect), aspect) - h(40, 9 / 16)) < 1e-9);
    assert.equal(fitVerticalFov(40, 9 / 16).toFixed(9), (40).toFixed(9));
  });
  it('every shot of every piece evaluates finite lenses in every format', () => {
    for (const spec of Object.values(CONTENT)) for (const format of spec.formats ?? ['reel']) {
      const tl = compileContent(spec, { format });
      for (const s of tl.shots) {
        if (s.world === 'phone' || s.world === 'title') continue;
        for (const f of [s.start, s.start + (s.duration >> 1), s.start + s.duration - 1]) assert.ok(finiteLens(shotLens(tl, s, f)), `${spec.id} ${s.id}@${f}`);
      }
    }
  });
  it('framing does not orbit a subject who turns (facing locked per shot)', () => {
    const tl = compileContent(CONTENT['breaking-news']);
    const s = tl.shots.find((x) => x.beat === 'walk-off')!;
    const a = shotLens(tl, s, s.start);
    const b = shotLens(tl, s, s.start + s.duration - 1);
    const yaw = (l: typeof a) => Math.atan2(l.look.x - l.pos.x, l.look.z - l.pos.z);
    assert.ok(Math.abs(yaw(a) - yaw(b)) < 0.9, 'tracks, does not swing around');
  });
});
