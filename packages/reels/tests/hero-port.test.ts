/**
 * The first-generation hero trailer, re-expressed as a ContentSpec, must
 * compile to the same plan the legacy hand-written compiler produced
 * (fixture captured from the old ReelSpec pipeline before it was removed).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileContent } from '../src/engine/director/compile';
import { HNC_HERO } from '../src/content/hnc-hero';

interface LegacyShot {
  start: number;
  duration: number;
  camera: string;
  clock: { from: number; to: number; ramp?: string };
  effects: { type: string; start: number; duration: number | null; intensity: number | null }[];
  audio: { cue: string; frame: number; volume: number | null }[];
  overlays: { kind: string; data: Record<string, unknown> | null; text: string | null }[];
}
const legacy = JSON.parse(readFileSync(new URL('./fixtures/hnc-hero-legacy-plan.json', import.meta.url), 'utf8')) as { totalFrames: number; fps: number; shots: LegacyShot[] };
const tl = compileContent(HNC_HERO);

describe('hnc-hero port (ContentSpec == legacy plan)', () => {
  it('same frame count, fps and shot boundaries / cameras / clocks', () => {
    assert.equal(tl.totalFrames, legacy.totalFrames);
    assert.equal(tl.fps, legacy.fps);
    assert.equal(tl.shots.length, legacy.shots.length);
    tl.shots.forEach((s, i) => {
      const l = legacy.shots[i];
      assert.equal(s.start, l.start, s.id);
      assert.equal(s.duration, l.duration, s.id);
      assert.equal(s.camera.lens, l.camera, s.id);
      assert.deepEqual({ from: s.clock!.from, to: s.clock!.to, ramp: s.clock!.ramp }, { from: l.clock.from, to: l.clock.to, ramp: l.clock.ramp }, s.id);
    });
  });
  it('effects land on the same frames', () => {
    tl.shots.forEach((s, i) => {
      const l = legacy.shots[i];
      const got = s.fx.map((e) => `${e.type}@${e.start}`).sort();
      const want = l.effects.map((e) => `${e.type}@${e.start}`).sort();
      assert.deepEqual(got, want, s.id);
    });
  });
  it('every sound cue lands on the same frame with the same volume', () => {
    const got = tl.sounds.map((s) => `${s.cue}@${s.frame}:${s.volume}`).sort();
    const want = legacy.shots.flatMap((l) => l.audio.map((a) => `${a.cue}@${a.frame}:${a.volume ?? 1}`)).sort();
    assert.deepEqual(got, want);
  });
  it('graphic timings match (eyebrow, scoreboard flip, goal call, table, brand)', () => {
    const find = (type: string) => tl.overlays.find((o) => o.type === type)!;
    const legacyData = (kind: string) => legacy.shots.flatMap((l) => l.overlays).find((o) => o.kind === kind)!.data!;
    assert.equal(find('eyebrow').start, legacyData('eyebrow').at);
    assert.equal(find('eyebrow').props.exitAt, legacyData('eyebrow').exitAt);
    const sb = legacy.shots[1].overlays.find((o) => o.kind === 'scoreboard')!.data!;
    assert.equal(find('scoreboard').props.enterAt, sb.enterAt);
    assert.equal(find('scoreboard').props.flipAt, sb.flipAt);
    assert.equal(find('goal-call').start, legacyData('goal-call').at);
    assert.equal(find('goal-call').props.exitAt, legacyData('goal-call').exitAt);
    const wt = legacyData('world-table');
    assert.equal(find('world-table').start, wt.enterAt);
    assert.equal(find('world-table').props.climbAt, wt.climbAt);
    assert.equal(find('world-table').props.exitAt, wt.exitAt);
    assert.equal(find('brand-reveal').props.at, legacyData('brand-reveal').at);
  });
});
