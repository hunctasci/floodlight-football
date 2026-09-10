import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_PURPOSE, isFiniteLens } from '../src/cameras/presets.ts';
import {
  resolveTrailerSpec, parseTrailer, parseTrailerCountries, resolveVideoSpec, SocialSpecError,
} from '../src/schema.ts';
import { compileTrailer } from '../src/trailers/compile.ts';
import {
  evaluateTrailerFrame, trailerLocalFrame, trailerLocalTime, trailerSegmentAtTime,
} from '../src/trailers/evaluate.ts';
import { compileVideo, evaluateFrame, sceneFrameToRenderInput } from '../src/timeline.ts';

const COUNTRIES = 'TR,GR,BR,AR,DE,FR';
const trl = (extra: Record<string, unknown> = {}) =>
  compileTrailer({ trailer: 'world-league-hero', countries: COUNTRIES, seed: 42, fps: 60, ...extra });

// ---------------------------------------------------------------------------
// Spec validation (AI-facing: trailer + countries + seed only)
// ---------------------------------------------------------------------------

test('trailer spec: unknown trailer + bad countries fail loudly', () => {
  assert.throws(() => parseTrailer('goal-of-day'), /Unknown trailer: goal-of-day/);
  assert.throws(() => parseTrailerCountries('TR,GR,BR'), /expected 6 codes/);
  assert.throws(() => parseTrailerCountries('TR,GR,BR,AR,DE,XX'), /Unknown country code: XX/);
  assert.throws(
    () => resolveVideoSpec({ trailer: 'world-league-hero', scene: 'faceoff', home: 'TR', away: 'GR' }),
    (e) => e instanceof SocialSpecError,
  );
  assert.throws(
    () => resolveTrailerSpec({ trailer: undefined, countries: COUNTRIES }),
    /Missing trailer/,
  );
});

test('trailer spec defaults: 60fps, 17.6s, 1056 frames', () => {
  const r = resolveTrailerSpec({ trailer: 'world-league-hero', countries: COUNTRIES, seed: 42 });
  assert.equal(r.fps, 60);
  assert.equal(r.duration, 17.6);
  assert.equal(r.totalFrames, 1056);
  assert.deepEqual([...r.countries], ['TR', 'GR', 'BR', 'AR', 'DE', 'FR']);
});

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

test('trailer compilation: world-league-hero compiles at 60fps', () => {
  const t = trl();
  assert.equal(t.trailer, 'world-league-hero');
  assert.equal(t.duration, 17.6);
  assert.equal(t.fps, 60);
  assert.equal(t.totalFrames, 1056);
  assert.equal(t.width, 1080);
  assert.equal(t.height, 1920);
  assert.ok(t.shots.length >= 30, `montage has montage-scale shot count (got ${t.shots.length})`);
});

test('segment coverage: no gaps, no overlaps, global duration covered exactly', () => {
  const t = trl();
  assert.equal(t.shots[0].start, 0);
  for (let i = 0; i < t.shots.length; i++) {
    const s = t.shots[i];
    assert.ok(s.end > s.start, `${s.id} has positive duration`);
    assert.ok(Math.abs(s.srcEnd - s.srcStart) > 0, `${s.id} has a positive source excerpt`);
    if (i > 0) {
      assert.ok(Math.abs(s.start - t.shots[i - 1].end) < 1e-9, `${s.id} starts where ${t.shots[i - 1].id} ends`);
    }
  }
  const last = t.shots[t.shots.length - 1];
  assert.ok(Math.abs(last.end - t.duration) < 1e-9, 'shots cover the global duration exactly');
});

test('no full 6-second source story is embedded: every excerpt is a short beat', () => {
  const t = trl();
  for (const s of t.shots) {
    const srcLen = s.srcEnd - s.srcStart;
    // Story beats extract 1–3s best moments (impact holds stretch time, so
    // the source slice stays tiny); message/brand backgrounds may breathe
    // longer over living celebration, never a full standalone clip.
    const limit = s.purpose === 'message' || s.purpose === 'brand' ? 1.35 : 0.7;
    assert.ok(srcLen <= limit + 1e-9, `${s.id} excerpt is ${srcLen.toFixed(2)}s (must extract best beats, never a full story)`);
  }
  // The three reused scenes appear only as excerpts.
  const bySource = new Map<string, number>();
  for (const s of t.shots) bySource.set(s.source, (bySource.get(s.source) ?? 0) + (s.end - s.start));
  assert.ok((bySource.get('cross-header-goal') ?? 0) < 6, 'cross-header appears as excerpts, not a full clip');
  assert.ok((bySource.get('crossbar-chaos') ?? 0) < 6, 'crossbar appears as excerpts, not a full clip');
  assert.ok((bySource.get('keeper-disaster') ?? 0) < 6, 'keeper appears as excerpts, not a full clip');
});

// ---------------------------------------------------------------------------
// Source excerpts: global → local mapping
// ---------------------------------------------------------------------------

test('source excerpts map global time to the right local time', () => {
  const t = trl();
  const at = (time: number) => trailerSegmentAtTime(t, time);
  // Header hero: trailer 4.65 (cut) ↔ cross-header source 5.80 (contact).
  const header = at(4.65);
  assert.equal(header.id, 's13-header');
  assert.ok(Math.abs(trailerLocalTime(header, 4.65) - 5.80) < 1e-9);
  // Crossbar clang: trailer 7.35 ↔ crossbar source 4.30 (barHit).
  const clang = at(7.35);
  assert.equal(clang.id, 's22-clang');
  assert.ok(Math.abs(trailerLocalTime(clang, 7.35) - 4.30) < 1e-9);
  // Glove save: trailer 9.95 ↔ keeper source 3.30 (saveMoment).
  const glove = at(9.95);
  assert.equal(glove.id, 's32-glove');
  assert.ok(Math.abs(trailerLocalTime(glove, 9.95) - 3.30) < 1e-9);
  // Brand: trailer 16.15 ↔ attack-goal source 7.30 (celebration).
  const brand = at(16.15);
  assert.equal(brand.id, 's44-brand');
  assert.ok(Math.abs(trailerLocalTime(brand, 16.15) - 7.30) < 1e-9);
});

test('segment boundaries are hard cuts on events, last frame belongs to brand', () => {
  const t = trl();
  assert.equal(trailerSegmentAtTime(t, 0).id, 's01-tr-portrait');
  assert.equal(trailerSegmentAtTime(t, 1.50).id, 's05-kickoff', '1.50 is the kick cut');
  assert.equal(trailerSegmentAtTime(t, 3.45).id, 's10-cross-flight', '3.45 is the cross-contact cut');
  assert.equal(trailerSegmentAtTime(t, 4.65).id, 's13-header', '4.65 is the header cut');
  assert.equal(trailerSegmentAtTime(t, 6.20).id, 's19-card-brar', '6.20 is the graphic cut');
  assert.equal(trailerSegmentAtTime(t, 9.00).id, 's29-card-defr');
  assert.equal(trailerSegmentAtTime(t, 11.65).id, 'm01-eye', '11.65 opens the percussion montage');
  assert.equal(trailerSegmentAtTime(t, 13.20).id, 's39-pick');
  assert.equal(trailerSegmentAtTime(t, 16.15).id, 's44-brand');
  assert.equal(trailerSegmentAtTime(t, 17.60).id, 's44-brand', 'endpoint belongs to the brand');
});

// ---------------------------------------------------------------------------
// Story source identity: same local time → same world state (camera may differ)
// ---------------------------------------------------------------------------

test('trailer source identity: world state equals standalone scene evaluation', () => {
  const t = trl();
  // Trailer frame 240 (t=4.0s) lives in s11-mouth: cross-header TR/GR excerpt.
  const frame = 240;
  const result = evaluateTrailerFrame(t, frame);
  assert.equal(result.segment.id, 's11-mouth');
  const standalone = compileVideo({
    scene: 'cross-header-goal', home: 'TR', away: 'GR', seed: 42, fps: 60, duration: 8, overlays: 'none',
  });
  const expected = evaluateFrame(standalone, result.localFrame);
  const expectedInput = sceneFrameToRenderInput(standalone, expected);
  assert.deepEqual(result.input.state, expectedInput.state, 'same players/ball/teams as standalone source');
  assert.deepEqual(result.input.pose, expectedInput.pose, 'same poses as standalone source');
  assert.deepEqual(result.input.crowd, expectedInput.crowd, 'same crowd as standalone source');
});

// ---------------------------------------------------------------------------
// Random access + determinism
// ---------------------------------------------------------------------------

test('trailer random access: frame N is stable after arbitrary evaluations', () => {
  const t = trl();
  const direct = evaluateTrailerFrame(t, 1055);
  for (const f of [0, 400, 72, 441, 600, 900, 200]) evaluateTrailerFrame(t, f);
  assert.deepEqual(evaluateTrailerFrame(t, 1055), direct);
  // Local-frame mapping is a pure function of the global frame.
  const seg = trailerSegmentAtTime(t, 600 / 60);
  assert.equal(trailerLocalFrame(t, seg, 600), evaluateTrailerFrame(t, 600).localFrame);
});

test('trailer determinism: double compile + evaluate deep-equal', () => {
  const a = trl();
  const b = trl();
  assert.deepEqual(
    a.shots.map((s) => [s.id, s.start, s.end, s.srcStart, s.srcEnd, s.camera]),
    b.shots.map((s) => [s.id, s.start, s.end, s.srcStart, s.srcEnd, s.camera]),
  );
  for (const frame of [0, 24, 100, 240, 282, 441, 597, 700, 900, 1000, 1055]) {
    assert.deepEqual(evaluateTrailerFrame(a, frame), evaluateTrailerFrame(b, frame), `frame ${frame} deterministic`);
  }
});

test('out-of-range trailer frames fail clearly', () => {
  const t = trl();
  assert.throws(() => evaluateTrailerFrame(t, -1), /Invalid frame: -1/);
  assert.throws(() => evaluateTrailerFrame(t, 1056), /Invalid frame: 1056/);
});

// ---------------------------------------------------------------------------
// Camera plan: purpose per shot, finite lenses, hard cuts only
// ---------------------------------------------------------------------------

test('camera plan: every shot has a purpose and a finite lens', () => {
  const t = trl();
  const purposes = new Set(t.shots.map((s) => s.purpose));
  for (const need of ['geography', 'character', 'speed', 'impact', 'reaction', 'reveal', 'message', 'brand']) {
    assert.ok(purposes.has(need as never), `purpose ${need} covered`);
  }
  for (const s of t.shots) {
    if (s.camera !== 'source') {
      assert.ok((CAMERA_PURPOSE as Record<string, string>)[s.camera], `${s.id}/${s.camera} is director vocabulary`);
    }
  }
  // Midpoint of every shot resolves a finite, sane lens.
  for (const s of t.shots) {
    const mid = Math.min(t.totalFrames - 1, Math.floor(((s.start + s.end) / 2) * t.fps));
    const lens = evaluateTrailerFrame(t, mid).input.camera;
    assert.ok(isFiniteLens(lens), `${s.id} lens is finite`);
    assert.ok(lens.fov >= 40 && lens.fov <= 65, `${s.id} fov sane (${lens.fov})`);
  }
});

test('new trailer cameras resolve finite lenses', () => {
  const t = trl();
  const byCam = new Map<string, string>();
  for (const s of t.shots) {
    if (s.camera !== 'source' && !byCam.has(s.camera)) byCam.set(s.camera, s.id);
  }
  for (const need of ['duel-chase', 'ball-chase', 'player-portrait', 'boot-ball']) {
    assert.ok(byCam.has(need), `trailer uses new camera ${need} (${byCam.get(need) ?? 'missing'})`);
  }
});

// ---------------------------------------------------------------------------
// Audio: one bed, shifted excerpts in sync, brand sting
// ---------------------------------------------------------------------------

test('trailer audio: single ambience, shifted impacts, one sting', () => {
  const audio = trl().audio;
  assert.equal(audio.duration, 17.6);
  const ambience = audio.events.filter((e) => e.type === 'ambience');
  assert.equal(ambience.length, 1, 'one continuous global ambience bed');
  assert.deepEqual([ambience[0].time, ambience[0].duration], [0, 17.6]);
  const stings = audio.events.filter((e) => e.type === 'sting');
  assert.equal(stings.length, 1, 'a single brand sting (scene stings dropped)');
  assert.ok(stings[0].time >= 16.0, `sting at the payoff (${stings[0].time})`);
  const near = (type: string, at: number, tol = 0.03) =>
    audio.events.some((e) => e.type === type && Math.abs(e.time - at) <= tol);
  assert.ok(near('whistle', 0.78, 0.05), 'kickoff whistle on the boot insert');
  assert.ok(near('header', 4.65), 'header THUMP at the hero frame');
  assert.ok(near('crossbar', 7.35), 'CLANG at the crossbar cut');
  assert.ok(near('save', 9.95), 'glove SAVE impact');
  assert.ok(near('goal', 5.10, 0.25), 'first goal roar at the net');
  assert.ok(near('goal', 11.08, 0.25), 'keeper-disaster goal roar');
  // No duplicate scene ambience beds leak in.
  assert.ok(audio.events.every((e) => e.time < 17.6), 'no event past the trailer end');
});

// ---------------------------------------------------------------------------
// Overlays + branding: hook, matchup cards, concept lines, payoff hold
// ---------------------------------------------------------------------------

test('trailer overlays: hook → matchup cards → concept → brand hold', () => {
  const t = trl();
  const kindsAt = (frame: number): string[] =>
    evaluateTrailerFrame(t, frame).overlays.overlays.map((o) => o.kind).sort();
  assert.deepEqual(kindsAt(10), ['headline'], 'first second hooks with PICK YOUR COUNTRY.');
  const hook = evaluateTrailerFrame(t, 10).overlays.overlays.find((o) => o.kind === 'headline');
  assert.equal(hook?.text, 'PICK YOUR COUNTRY.');
  assert.deepEqual(kindsAt(Math.round(6.3 * 60)), ['versus'], 'BR/AR graphic card');
  assert.deepEqual(kindsAt(Math.round(9.1 * 60)), ['versus'], 'DE/FR graphic card');
  const pick = evaluateTrailerFrame(t, Math.round(13.5 * 60)).overlays.overlays.find((o) => o.kind === 'headline');
  assert.equal(pick?.text, 'PICK A COUNTRY');
  const win = evaluateTrailerFrame(t, Math.round(14.0 * 60)).overlays.overlays.find((o) => o.kind === 'headline');
  assert.equal(win?.text, 'WIN 1V1 MATCHES');
  const climb = evaluateTrailerFrame(t, Math.round(14.8 * 60)).overlays.overlays.find((o) => o.kind === 'headline');
  assert.equal(climb?.text, 'CLIMB THE WORLD LEAGUE');
  // No permanent logo: brand appears only at the payoff.
  assert.ok(!kindsAt(Math.round(5.0 * 60)).includes('brand'), 'no brand over the football');
  assert.ok(!kindsAt(Math.round(12.0 * 60)).includes('brand'), 'no brand over the montage');
  assert.deepEqual(kindsAt(Math.round(17.0 * 60)).sort(), ['brand', 'cta'], 'payoff holds badge + CTA');
  assert.deepEqual(kindsAt(1055).sort(), ['brand', 'cta'], 'final frame holds the end card');
  const plan = t.overlayPlan;
  const brand = plan.find((e) => e.kind === 'brand');
  const cta = plan.find((e) => e.kind === 'cta');
  assert.ok(brand && cta);
  assert.ok(brand.start >= 16.0 && brand.start <= 16.4, `brand starts near the end (${brand.start})`);
  assert.ok(t.duration - brand.start >= 1.2, `badge readable ≥1.2s (${(t.duration - brand.start).toFixed(2)}s)`);
  assert.equal(cta.text, 'PLAY FOR YOUR COUNTRY');
});

test('--no-overlays disables the whole trailer overlay plan', () => {
  const t = trl({ overlays: 'none' });
  assert.deepEqual(t.overlayPlan, []);
  assert.deepEqual(evaluateTrailerFrame(t, 1000).overlays.overlays, []);
});
