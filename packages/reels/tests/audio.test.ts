import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { duckGain } from '../src/audio/mix';
import { CUES } from '../src/audio/registry';
import { SOCIAL_RECIPES } from '../src/audio/social-synth';
import { gameEvents, renderStemSamples, renderStemWav } from '../src/audio/stem';
import { CONTENT } from '../src/content';
import { compileContent } from '../src/engine/director/compile';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe('audio', () => {
  it('every cue is playable: a game recipe, a social recipe or a bundled file', () => {
    for (const [id, c] of Object.entries(CUES)) {
      if (c.source === 'social') assert.ok(SOCIAL_RECIPES[id], `${id} has no social recipe`);
      if (c.source === 'game') assert.ok(c.recipe, id);
      if (c.source === 'file') assert.ok(existsSync(path.join(root, 'public', c.file!)), `${id}: ${c.file} missing`);
    }
  });
  it('the stem is byte-deterministic and never clips', () => {
    for (const id of ['office-rivalry', 'breaking-news']) {
      const tl = compileContent(CONTENT[id]);
      assert.ok(renderStemWav(tl).equals(renderStemWav(tl)), id);
      assert.ok(renderStemSamples(tl).every((v) => Math.abs(v) <= 0.97), id);
    }
  });
  it('the hero keeps its arcade SFX on the choreography beats', () => {
    const tl = compileContent(CONTENT['hnc-hero']);
    const ev = gameEvents(tl);
    const shot = tl.shots.find((s) => s.beat === 'shot')!;
    const burst = shot.fx.find((e) => e.type === 'impact-burst')!;
    assert.ok(ev.some((e) => e.type === 'shot' && Math.abs(e.time - burst.start / tl.fps) < 1 / 60));
    assert.ok(ev.some((e) => e.type === 'goal') && ev.some((e) => e.type === 'sting'));
  });
  it('hush ducks the beds for its span (comedic silence)', () => {
    const tl = compileContent(CONTENT['office-rivalry']);
    const hush = tl.sounds.find((s) => s.cue === 'hush')!;
    assert.ok(duckGain(tl, hush.frame + 5) < 0.3);
    assert.equal(duckGain(tl, 0), 1);
  });
});
