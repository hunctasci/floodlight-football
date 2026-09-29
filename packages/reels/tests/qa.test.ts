import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT } from '../src/content';
import { compileContent } from '../src/engine/director/compile';
import { qaTimeline } from '../src/engine/qa';
import type { ContentSpec } from '../src/engine/spec/types';

describe('framing + motion QA', () => {
  it('every registered piece has zero QA errors in every declared format', () => {
    for (const spec of Object.values(CONTENT)) {
      for (const format of spec.formats ?? ['reel']) {
        const errs = qaTimeline(compileContent(spec, { format })).filter((q) => q.level === 'error');
        assert.deepEqual(errs, [], `${spec.id} ${format}`);
      }
    }
  });
  it('catches the first-generation bugs: lens inside a body, subject out of frame', () => {
    const spec = JSON.parse(JSON.stringify(CONTENT['office-rivalry'])) as ContentSpec;
    spec.scenes = [spec.scenes[0]];
    delete spec.keyArt;
    spec.scenes[0].beats[2].camera = { lens: 'close', on: 'hero', move: ['push-in'], amount: 3.6 };
    spec.scenes[0].beats[3].camera = { lens: 'close', on: 'rival', to: { lens: 'macro', on: 'wall-clock' } };
    const msgs = qaTimeline(compileContent(spec)).map((q) => q.message).join('\n');
    assert.match(msgs, /lens inside "hero"/);
    assert.match(msgs, /subject "rival" is out of frame/);
  });
  it('catches an overcranked clock (sprint faster than a human)', () => {
    const spec = JSON.parse(JSON.stringify(CONTENT['group-chat'])) as ContentSpec;
    spec.scenes[1].beats[1].duration = 0.6;
    const warns = qaTimeline(compileContent(spec)).filter((q) => /runs at/.test(q.message) && q.shot.endsWith('burst'));
    assert.ok(warns.length > 0);
  });
});
