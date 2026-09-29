import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT } from '../src/content';
import { compileContent } from '../src/engine/director/compile';
import { FORMATS, FORMAT_IDS } from '../src/engine/formats';
import type { ContentSpec } from '../src/engine/spec/types';

const specs = Object.values(CONTENT);

describe('director: ContentSpec → Timeline', () => {
  it('is deterministic (same spec → deep-equal, JSON-stable timeline)', () => {
    for (const spec of specs) {
      const a = compileContent(spec);
      const b = compileContent(JSON.parse(JSON.stringify(spec)) as ContentSpec);
      assert.deepEqual(a, b, spec.id);
      assert.equal(JSON.stringify(a), JSON.stringify(JSON.parse(JSON.stringify(a))));
    }
  });
  it('shots tile [0, total) exactly with no rounding drift', () => {
    for (const spec of specs) {
      const tl = compileContent(spec);
      let cursor = 0;
      for (const s of tl.shots) {
        assert.equal(s.start, cursor, `${spec.id} ${s.id}`);
        assert.ok(s.duration > 0);
        cursor += s.duration;
      }
      const seconds = spec.scenes.flatMap((sc) => sc.beats).reduce((a, b) => a + b.duration, 0);
      assert.equal(cursor, tl.totalFrames);
      assert.equal(tl.totalFrames, Math.round(seconds * tl.fps));
    }
  });
  it('every format keeps timing and only changes the frame size', () => {
    for (const spec of specs) {
      const base = compileContent(spec, { format: 'reel' });
      for (const f of FORMAT_IDS) {
        const tl = compileContent(spec, { format: f });
        assert.equal(tl.width, FORMATS[f].width);
        assert.equal(tl.height, FORMATS[f].height);
        assert.deepEqual(tl.shots, base.shots);
        assert.deepEqual(tl.sounds, base.sounds);
      }
    }
  });
  it('scene staging persists: marks and running actions carry across beats', () => {
    const tl = compileContent(CONTENT['office-rivalry']);
    const clue = tl.shots.find((s) => s.beat === 'clue')!;
    const rival = clue.actors.find((a) => a.cast === 'rival')!;
    assert.equal(rival.mark, 'desk-b');
    assert.equal(rival.keys[0].action, 'typing', 'typing keeps running under a macro cutaway');
    assert.equal(rival.keys[0].frame, 0, 'the loop keeps its original clock (no restart on cut)');
  });
  it('cast identity is shared by every world (office worker == #9)', () => {
    const tl = compileContent(CONTENT['office-rivalry']);
    const office = tl.shots.find((s) => s.world === 'office')!;
    const match = tl.shots.find((s) => s.world === 'football')!;
    assert.equal(office.looks.hero, 'office');
    assert.equal(match.looks.hero, 'kit');
    assert.equal(tl.cast.hero.number, 9);
    const monday = tl.shots.find((s) => s.scene === 'monday')!;
    assert.equal(monday.looks.hero, 'kit', 'scene look override');
  });
  it('transitions own windows around the cut and bring their sounds', () => {
    const tl = compileContent(CONTENT['office-rivalry']);
    const faceoff = tl.shots.find((s) => s.beat === 'faceoff')!;
    const ev = faceoff.enter!;
    assert.equal(ev.type, 'light-bloom');
    assert.equal(ev.cut, faceoff.start);
    assert.ok(ev.start < ev.cut && ev.end > ev.cut);
    assert.equal(tl.shots[tl.shots.indexOf(faceoff) - 1].exit, ev);
    assert.ok(tl.sounds.some((s) => s.cue === 'bloom' && s.frame === ev.start));
    const zoom = compileContent(CONTENT['group-chat']).shots.find((s) => s.enter?.type === 'zoom-through')!;
    assert.equal(zoom.enter!.overlap, true);
    assert.equal(zoom.enter!.start, zoom.start, 'zoom-through window follows the cut');
  });
  it('world ambience beds cover their scene unless disabled', () => {
    const tl = compileContent(CONTENT['office-rivalry']);
    const beds = tl.sounds.filter((s) => s.cue === 'office-tone');
    assert.equal(beds.length, 2, 'two office scenes');
    assert.equal(compileContent(CONTENT['hnc-hero']).sounds.filter((s) => s.cue === 'crowd-bed').length, 1, 'hero opts out and places its own bed');
  });
  it('world clocks chain by default and moment times resolve through them', () => {
    const tl = compileContent(CONTENT['hnc-hero']);
    for (let i = 1; i < tl.shots.length; i++) assert.equal(tl.shots[i].clock!.from, tl.shots[i - 1].clock!.to);
    const shot = tl.shots.find((s) => s.beat === 'shot')!;
    const burst = shot.fx.find((e) => e.type === 'impact-burst')!;
    assert.ok(burst.start > shot.start && burst.start < shot.start + shot.duration);
  });
  it('beat text that lasts into later beats becomes global (not clipped to its shot)', () => {
    const tl = compileContent(CONTENT['group-chat']);
    const pov = tl.overlays.find((o) => o.kind === 'text' && o.type === 'pov')!;
    const hook = tl.shots[0];
    assert.ok(pov.end > hook.start + hook.duration);
    assert.equal(pov.shot, undefined);
    const note = tl.overlays.find((o) => o.type === 'notification')!;
    assert.ok(note.shot, 'a beat-length graphic stays on its shot layer (zooms with it)');
  });
});
