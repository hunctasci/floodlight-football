import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreBugText } from '../src/diaries/ScoreBug';
import { EPISODES, timeline } from '../src/diaries/edit';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p: string): string => readFileSync(path.join(REPO, p), 'utf8');
const json = (p: string) => JSON.parse(read(p));
const EP = 'packages/reels/src/diaries/italy-rematch';
const edit = () => json(`${EP}/edit.json`);
const dialogue = () => json(`${EP}/dialogue.json`);
/** Cue names registered in the Python mixer's CUES dict (keys are `"name":`). */
const cueNames = (): Set<string> => {
  const src = read('tools/diaries/py/sfx.py');
  const block = src.slice(src.indexOf('CUES = {'), src.indexOf('# Beds fill the span'));
  return new Set([...block.matchAll(/"([a-z0-9-]+)":/g)].map((m) => m[1]));
};

describe('italy-rematch episode data', () => {
  it('every sfx cue in the cut exists in the mixer', () => {
    const names = cueNames();
    const missing = edit().shots.flatMap((s: any) => (s.sfx ?? []).map((c: any) => c.cue)).filter((c: string) => !names.has(c));
    assert.deepEqual([...new Set(missing)], []);
  });
  it('every dialogue line placed in the cut exists in dialogue.json', () => {
    const ids = new Set(dialogue().lines.map((l: any) => l.id));
    const missing = edit().shots.flatMap((s: any) => (s.dialogue ?? []).map((d: any) => d.line)).filter((id: string) => !ids.has(id));
    assert.deepEqual(missing, []);
  });
});

describe('italy-rematch dialogue', () => {
  it('has the 19 commentator lines and only NINE/COMM speakers', () => {
    const d = dialogue();
    const comm = d.lines.filter((l: any) => l.speaker === 'COMM').map((l: any) => l.id);
    assert.deepEqual(comm, Array.from({ length: 19 }, (_, i) => `L${String(i + 3).padStart(2, '0')}`));
    assert.deepEqual([...new Set(d.lines.map((l: any) => l.speaker))].sort(), ['COMM', 'NINE']);
    assert.equal(d.speakers.COMM.engine, 'qwen');
    for (const l of d.lines) assert.ok(l.tr, `${l.id} needs a Turkish line`);
  });
  it('every line has an approved take', () => {
    const vo = 'packages/reels/public/generated/diaries/italy-rematch/vo';
    for (const l of dialogue().lines) assert.ok(existsSync(path.join(REPO, vo, `${l.id}.wav`)), `${l.id}.wav missing`);
  });
});

describe('italy-rematch cut v2', () => {
  const voices = () => json('packages/reels/public/generated/diaries/italy-rematch/vo/voices.json');
  const placed = () => {
    const v = voices();
    let t = 0;
    const out: { id: string; a: number; b: number }[] = [];
    for (const s of edit().shots) {
      for (const d of s.dialogue ?? []) out.push({ id: d.line, a: t + d.at, b: t + d.at + v[d.line].seconds });
      t += s.dur;
    }
    return { out: out.sort((x, y) => x.a - y.a), total: t };
  };
  it('places every line exactly once', () => {
    assert.deepEqual(placed().out.map((p) => p.id).sort(), dialogue().lines.map((l: any) => l.id).sort());
  });
  it('no dialogue overlaps (≥0.08 s gap)', () => {
    const { out } = placed();
    for (let i = 1; i < out.length; i++) assert.ok(out[i].a >= out[i - 1].b + 0.08, `${out[i - 1].id} runs into ${out[i].id}`);
  });
  it('runtime within 48–62 s', () => {
    const { total } = placed();
    assert.ok(total >= 48 && total <= 62, `runtime ${total.toFixed(2)} s`);
  });
  it('has the frame-0 hook and the score bug', () => {
    const e = edit();
    assert.match(e.hook.text, /1–4/);
    assert.equal(e.scoreBug.flip.shot, 'S13_SH01');
    assert.deepEqual(e.scoreBug.hideOn, ['S16_SH01']);
  });
});

describe('score bug', () => {
  const ep = EPISODES['italy-rematch'];
  const { shots } = timeline(ep.edit, 30);
  const bug = ep.edit.scoreBug!;
  const at = (id: string, s: number) => shots.find((x) => x.id === id)!.from + Math.round(s * 30);
  it('shows the loss from frame 0 until the wipe', () => {
    assert.equal(scoreBugText(shots, 30, bug, 0), 'TUR 1–4 ITA');
    assert.equal(scoreBugText(shots, 30, bug, at('S13_SH01', 1.1)), 'TUR 1–4 ITA');
  });
  it('flips to the rematch after the wipe', () => {
    assert.equal(scoreBugText(shots, 30, bug, at('S13_SH01', 1.3)), 'ITA 0–0 TUR · MON 5 OCT');
    assert.equal(scoreBugText(shots, 30, bug, at('S15_SH01', 0.5)), 'ITA 0–0 TUR · MON 5 OCT');
  });
  it('is hidden on the end card', () => {
    assert.equal(scoreBugText(shots, 30, bug, at('S16_SH01', 0.2)), null);
  });
});
