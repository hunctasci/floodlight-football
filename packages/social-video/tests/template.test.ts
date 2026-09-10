import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ATTACK_GOAL_BEATS } from '../src/scenes/attack-goal.ts';
import { GOAL_ROAR_DELAY } from '../src/audio/compile.ts';
import { evaluateAttackGoalFrame } from '../src/scenes/attack-goal.ts';
import { evaluateFaceoffFrame } from '../src/scenes/faceoff.ts';
import { compileVideo, evaluateFrame, sceneFrameToRenderInput } from '../src/timeline.ts';
import { resolveVideoSpec, SocialSpecError } from '../src/schema.ts';
import { compileTemplate } from '../src/templates/compile.ts';
import { evaluateTemplateFrame, segmentAtTime, templateLocalFrame } from '../src/templates/evaluate.ts';
import type { CompiledTemplate } from '../src/templates/types.ts';

const tpl = (extra: Record<string, unknown> = {}) =>
  compileTemplate({ template: 'country-rivalry-reel', home: 'TR', away: 'GR', seed: 42, fps: 30, ...extra });

const kindsAt = (t: CompiledTemplate, frame: number): string[] =>
  evaluateTemplateFrame(t, frame).overlays.overlays.map((o) => o.kind).sort();

function dryRunFails(args: string[]): string {
  try {
    execFileSync('npx', ['tsx', 'scripts/render-frame.ts', '--dry-run', ...args], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const err = error as { status?: number; stderr?: string };
    assert.equal(err.status, 1);
    return String(err.stderr);
  }
  assert.fail(`CLI should have rejected: ${args.join(' ')}`);
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

test('template default compilation: 15.5s, 465 frames, three segments', () => {
  const t = tpl();
  assert.equal(t.template, 'country-rivalry-reel');
  assert.equal(t.duration, 15.5);
  assert.equal(t.fps, 30);
  assert.equal(t.totalFrames, 465);
  assert.equal(t.width, 1080);
  assert.equal(t.height, 1920);
  assert.equal(t.segments.length, 3);
  assert.deepEqual(
    t.segments.map((s) => [s.kind, s.scene, s.start, s.duration]),
    [
      ['scene', 'faceoff', 0, 3.0],
      ['scene', 'attack-goal', 3.0, 9.5],
      ['outro', 'attack-goal', 12.5, 3.0],
    ],
  );
});

test('spec validation: exactly one of scene / template', () => {
  assert.match(
    dryRunFails(['--template', 'country-rivalry-reel', '--scene', 'faceoff', '--home', 'TR', '--away', 'GR']),
    /Specify either scene or template, not both\./,
  );
  assert.throws(
    () => resolveVideoSpec({ template: 'country-rivalry-reel', scene: 'faceoff', home: 'TR', away: 'GR' }),
    (e) => e instanceof SocialSpecError,
  );
  assert.throws(
    () => resolveVideoSpec({ template: 'goal-of-day', home: 'TR', away: 'GR' }),
    /Unknown template: goal-of-day/,
  );
  assert.throws(
    () => resolveVideoSpec({ template: 'country-rivalry-reel', home: 'TR', away: 'GR', duration: 8 }),
    /Duration is defined by the template/,
  );
  // Template spec resolves with template duration, not a scene default.
  const spec = resolveVideoSpec({ template: 'country-rivalry-reel', home: 'TR', away: 'GR' });
  assert.equal(spec.template, 'country-rivalry-reel');
  assert.equal(spec.duration, 15.5);
  assert.equal(spec.totalFrames, 465);
});

// ---------------------------------------------------------------------------
// Segment boundaries ([start, end), last segment covers the endpoint)
// ---------------------------------------------------------------------------

test('segment boundaries resolve the active segment', () => {
  const t = tpl();
  const at = (time: number): string => {
    const s = segmentAtTime(t, time);
    return `${s.kind}:${s.scene}@${s.start}`;
  };
  assert.equal(at(0.0), 'scene:faceoff@0');
  assert.equal(at(2.9), 'scene:faceoff@0');
  assert.equal(at(3.0), 'scene:attack-goal@3', '3.0 is the hard cut: attack owns it');
  assert.equal(at(5.0), 'scene:attack-goal@3');
  assert.equal(at(12.4), 'scene:attack-goal@3');
  assert.equal(at(12.5), 'outro:attack-goal@12.5', '12.5 hands off to the outro');
  assert.equal(at(15.4), 'outro:attack-goal@12.5');
  assert.equal(at(15.5), 'outro:attack-goal@12.5', 'endpoint belongs to the last segment');
});

test('global → local frame mapping', () => {
  const t = tpl();
  const attack = t.segments[1];
  // Global 8.4s inside the attack segment (start 3.0) → local 5.4s → frame 162.
  assert.equal(templateLocalFrame(t, attack, 252), 162);
  const faceoff = t.segments[0];
  assert.equal(templateLocalFrame(t, faceoff, 30), 30);
  // Outro continues the attack clock past 9.5s: global 12.5 → attack local 9.5.
  const outro = t.segments[2];
  assert.equal(templateLocalFrame(t, outro, 375), 285);
  assert.equal(templateLocalFrame(t, outro, 464), 374);
});

// ---------------------------------------------------------------------------
// Scene identity: template reuses evaluators, never duplicates choreography
// ---------------------------------------------------------------------------

test('template attack frames deep-equal standalone attack-goal evaluation', () => {
  const t = tpl();
  const attackSeg = t.segments[1];
  const standalone = compileVideo({ scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 9.5, overlays: 'none' });
  for (const [global, local] of [[150, 60], [100, 10], [240, 150]] as const) {
    const result = evaluateTemplateFrame(t, global);
    const expected = evaluateFrame(standalone, local);
    assert.deepEqual(result.input, sceneFrameToRenderInput(standalone, expected), `global ${global} ≡ attack local ${local}`);
  }
});

test('template faceoff frames deep-equal a 3.0s standalone faceoff slice', () => {
  const t = tpl();
  const standalone = compileVideo({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 3.0, overlays: 'none' });
  for (const frame of [0, 30, 60, 89]) {
    const result = evaluateTemplateFrame(t, frame);
    const expected = evaluateFrame(standalone, frame);
    assert.deepEqual(result.input, sceneFrameToRenderInput(standalone, expected), `faceoff frame ${frame} identical`);
  }
});

test('outro boundary is continuous: outro start === attack end state (push 0)', () => {
  const t = tpl();
  const atCut = evaluateTemplateFrame(t, 375); // global 12.5 → attack local 9.5
  const attackSeg = t.segments[1];
  assert.ok(attackSeg.video.attackGoal, 'attack staging compiled');
  const endState = evaluateAttackGoalFrame({
    data: attackSeg.video.attackGoal,
    home: 'TR', away: 'GR', seed: 42, frame: 285, fps: 30, duration: 9.5,
  });
  assert.deepEqual(atCut.input, sceneFrameToRenderInput(attackSeg.video, endState));
});

test('outro camera pushes in deterministically while celebration stays alive', () => {
  const t = tpl();
  const early = evaluateTemplateFrame(t, 376).input.camera;
  const late = evaluateTemplateFrame(t, 464).input.camera;
  assert.ok(late.fov < early.fov, `fov narrows ${early.fov} → ${late.fov}`);
  const dist = (c: typeof early): number => Math.hypot(c.pos.x - c.look.x, c.pos.y - c.look.y, c.pos.z - c.look.z);
  assert.ok(dist(late) < dist(early), 'camera dollies toward the celebration');
});

// ---------------------------------------------------------------------------
// Overlay ownership (scenes own content, template owns the end card)
// ---------------------------------------------------------------------------

test('template overlay ownership across the global timeline', () => {
  const t = tpl();
  assert.deepEqual(kindsAt(t, 10), ['versus'], 'intro rivalry title');
  assert.deepEqual(kindsAt(t, 75), ['headline'], 'intro closes on PICK A SIDE');
  const final = evaluateTemplateFrame(t, 89).overlays.overlays.find((o) => o.kind === 'headline');
  assert.ok(final && final.opacity > 0.9, `final intro frame holds full headline (opacity=${final?.opacity})`);
  assert.deepEqual(kindsAt(t, 100).sort(), ['versus'], 'attack context strip after the cut');
  assert.deepEqual(kindsAt(t, 270), ['goal'], 'goal punch belongs to the attack scene');
  assert.deepEqual(kindsAt(t, 320), ['headline'], 'celebration headline');
  assert.deepEqual(kindsAt(t, 390), ['brand', 'cta'], 'template owns the outro end card');
  assert.deepEqual(kindsAt(t, 464), ['brand', 'cta'], 'end card holds on the final frame');
  // No scene CTA/brand leaks before the outro.
  for (const frame of [100, 270, 320, 370]) {
    const kinds = kindsAt(t, frame);
    assert.ok(!kinds.includes('cta') && !kinds.includes('brand'), `frame ${frame} has no end-card layers`);
  }
});

test('custom headline reaches the attack celebration, not the intro title', () => {
  const t = tpl({ headline: 'ONE WIN FROM #1', cta: 'PLAY FOR TÜRKİYE' });
  const intro = evaluateTemplateFrame(t, 75).overlays.overlays.find((o) => o.kind === 'headline');
  assert.equal(intro?.text, 'PICK A SIDE', 'intro keeps the default rivalry line');
  const celeb = evaluateTemplateFrame(t, 320).overlays.overlays.find((o) => o.kind === 'headline');
  assert.equal(celeb?.text, 'ONE WIN FROM #1');
  const cta = evaluateTemplateFrame(t, 390).overlays.overlays.find((o) => o.kind === 'cta');
  assert.equal(cta?.text, 'PLAY FOR TÜRKİYE');
});

test('--no-overlays disables the whole template overlay plan', () => {
  const t = tpl({ overlays: 'none' });
  assert.deepEqual(t.overlayPlan, []);
  assert.deepEqual(evaluateTemplateFrame(t, 390).overlays.overlays, []);
});

// ---------------------------------------------------------------------------
// Audio composition (shifted scene SFX, single ambience, outro tail)
// ---------------------------------------------------------------------------

test('template audio: one ambience bed, shifted scene events, outro tail', () => {
  const audio = tpl().audio;
  assert.equal(audio.duration, 15.5);
  const ambience = audio.events.filter((e) => e.type === 'ambience');
  assert.equal(ambience.length, 1, 'a single continuous ambience bed');
  assert.deepEqual([ambience[0].time, ambience[0].duration], [0, 15.5]);
  const at = (type: string) => audio.events.filter((e) => e.type === type).map((e) => e.time);
  assert.ok(at('whistle').some((t) => Math.abs(t - 0.15) < 1e-9), 'faceoff whistle stays global');
  assert.ok(at('kick').some((t) => Math.abs(t - (3.0 + ATTACK_GOAL_BEATS.pass1Start)) < 1e-9), 'pass kick shifted +3.0');
  assert.ok(at('kick').some((t) => Math.abs(t - (3.0 + ATTACK_GOAL_BEATS.carryEnd)) < 1e-9), 'final-pass kick shifted +3.0');
  assert.ok(at('shot').some((t) => Math.abs(t - (3.0 + ATTACK_GOAL_BEATS.shotStart)) < 1e-9), `shot at ${(3.0 + ATTACK_GOAL_BEATS.shotStart).toFixed(2)} global`);
  // Human reaction delay: the real roar starts 80 ms after the ball crosses.
  assert.ok(at('goal').some((t) => Math.abs(t - (3.0 + ATTACK_GOAL_BEATS.shotEnd + GOAL_ROAR_DELAY)) < 1e-9), `goal roar at ${(3.0 + ATTACK_GOAL_BEATS.shotEnd + GOAL_ROAR_DELAY).toFixed(2)} global`);
  const tail = audio.events.find((e) => e.type === 'crowd' && e.time >= 12.5);
  assert.ok(tail, 'crowd tail carries into the outro');
  assert.ok(tail.time + tail.duration > 13.5, 'tail decays through the CTA, never cuts at 12.5');
});

// ---------------------------------------------------------------------------
// Determinism + random access
// ---------------------------------------------------------------------------

test('template determinism across representative frames', () => {
  const a = tpl();
  const b = tpl();
  assert.deepEqual(a.segments.map((s) => s.video.faceoff ?? s.video.attackGoal), b.segments.map((s) => s.video.faceoff ?? s.video.attackGoal));
  for (const frame of [0, 30, 89, 100, 240, 320, 390, 464]) {
    assert.deepEqual(evaluateTemplateFrame(a, frame), evaluateTemplateFrame(b, frame), `frame ${frame} deterministic`);
  }
});

test('template random access: last frame deep-equals after other evaluations', () => {
  const t = tpl();
  const direct = evaluateTemplateFrame(t, 464);
  for (const f of [0, 150, 100, 375, 390, 10, 240]) evaluateTemplateFrame(t, f);
  assert.deepEqual(evaluateTemplateFrame(t, 464), direct);
});

test('out-of-range template frames fail clearly', () => {
  const t = tpl();
  assert.throws(() => evaluateTemplateFrame(t, -1), /Invalid frame: -1/);
  assert.throws(() => evaluateTemplateFrame(t, 465), /Invalid frame: 465/);
});

test('outro end-card choreography: CTA settles first, badge punches 12.9–13.35 then holds', () => {
  const t = tpl();
  const plan = t.overlayPlan.filter((e) => e.kind === 'cta' || e.kind === 'brand');
  const cta = plan.find((e) => e.kind === 'cta');
  const brand = plan.find((e) => e.kind === 'brand');
  assert.ok(cta && brand);
  assert.equal(cta.start, 12.7, 'CTA begins settling while celebration is still visible');
  assert.equal(brand.start, 12.9, 'badge never covers the player immediately');
  // Frame 375 (12.5s): clean celebration, no end-card layers.
  assert.deepEqual(kindsAt(t, 375), [], 'outro opens on the celebration');
  // Frame 387 (12.9s): CTA nearly settled, badge at punch start (opacity 0, scale 0.75).
  const at387 = evaluateTemplateFrame(t, 387).overlays.overlays;
  const cta387 = at387.find((o) => o.kind === 'cta');
  const brand387 = at387.find((o) => o.kind === 'brand');
  assert.ok(cta387 && cta387.opacity > 0.8, `CTA settling (opacity=${cta387?.opacity})`);
  assert.ok(brand387 && Math.abs(brand387.opacity) < 1e-9, 'badge not yet visible at 12.9');
  assert.ok(brand387 && Math.abs(brand387.scale - 0.75) < 1e-9, 'badge punch starts at 0.75');
  // Frame 393 (13.1s): badge mid-punch near the 1.06 peak, CTA held.
  const at393 = evaluateTemplateFrame(t, 393).overlays.overlays;
  const brand393 = at393.find((o) => o.kind === 'brand');
  assert.ok(brand393 && brand393.opacity > 0.8, 'badge fading in');
  assert.ok(brand393 && brand393.scale > 1.05 && brand393.scale <= 1.061, `badge peaks ~1.06 (got ${brand393?.scale})`);
  // Frame 396 (13.2s): both held, badge settling toward 1.0.
  const at396 = evaluateTemplateFrame(t, 396).overlays.overlays;
  assert.ok(at396.find((o) => o.kind === 'cta')?.opacity === 1, 'CTA held');
  assert.ok(at396.find((o) => o.kind === 'brand')?.opacity === 1, 'badge held');
  // Final frame holds at scale 1.0 for a thumbnail-strong end card.
  const at464 = evaluateTemplateFrame(t, 464).overlays.overlays;
  assert.equal(at464.find((o) => o.kind === 'brand')?.scale, 1.0);
  assert.ok((at464.find((o) => o.kind === 'brand')?.opacity ?? 0) > 0.9);
});

test('scene end-card choreography is unchanged in shape (attack-goal CTA/brand together)', () => {
  const scene = compileVideo({ scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 9.5 });
  const cta = scene.overlayPlan.find((e) => e.kind === 'cta');
  const brand = scene.overlayPlan.find((e) => e.kind === 'brand');
  assert.ok(cta && brand);
  assert.equal(cta.start, 8.7, 'scene CTA timing');
  assert.equal(brand.start, 8.7, 'scene brand timing');
  assert.equal(scene.duration, 9.5, 'scene duration');
  assert.equal(tpl().duration, 15.5, 'template duration');
});

// ---------------------------------------------------------------------------
// Browser integration (selected frames only — never the full Reel in tests)
// ---------------------------------------------------------------------------

/** Chromium availability probe (same pattern as frame.test.ts). */
function chromiumAvailable(): boolean {
  const candidates = [
    path.join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright'),
    path.join(process.env.HOME ?? '', '.cache', 'ms-playwright'),
  ];
  return candidates.some((dir) => {
    try {
      return readdirSync(dir).some((entry) => entry.startsWith('chromium'));
    } catch {
      return false;
    }
  });
}

test('template browser frames render 1080x1920 (title/cut/goal/celebration/CTA)', { timeout: 240_000 }, async (t2) => {
  if (process.env.SOCIAL_BROWSER_TEST === '0' || !chromiumAvailable()) {
    t2.skip('Chromium not installed — run `npx playwright install chromium` to enable');
    return;
  }
  const { SocialRenderSession } = await import('../src/render/session.ts');
  const compiled = tpl();
  const dir = path.join(tmpdir(), 'hnc-template-test');
  mkdirSync(dir, { recursive: true });
  const session = await SocialRenderSession.openTemplate(compiled);
  try {
    for (const frame of [10, 75, 100, 270, 320, 390]) {
      const out = path.join(dir, `tpl-${String(frame).padStart(6, '0')}.png`);
      const rendered = await session.screenshotFrame(frame, out);
      assert.deepEqual({ width: rendered.width, height: rendered.height }, { width: 1080, height: 1920 });
      assert.ok(existsSync(out));
    }
  } finally {
    await session.close();
  }
});

test('short template MP4 fixture: composition encodes + validates', { timeout: 300_000 }, async (t2) => {
  if (process.env.SOCIAL_BROWSER_TEST === '0' || !chromiumAvailable()) {
    t2.skip('Chromium not installed — run `npx playwright install chromium` to enable');
    return;
  }
  const { resolveFfmpeg } = await import('../src/encode/ffmpeg.ts');
  try {
    resolveFfmpeg();
  } catch {
    t2.skip('FFmpeg not installed — install FFmpeg or set FFMPEG_PATH to enable');
    return;
  }
  const { SocialRenderSession } = await import('../src/render/session.ts');
  const { buildEncodeArgs, runFfmpeg } = await import('../src/encode/video.ts');
  const { probeMedia, validateMedia, hasFaststart } = await import('../src/encode/probe.ts');
  const { renderAudioToWav } = await import('../src/audio/render.ts');
  const { writeFileSync } = await import('node:fs');
  // Internal test fixture: 2s composition (production mapping untouched).
  const short = compileTemplate(
    { template: 'country-rivalry-reel', home: 'TR', away: 'GR', seed: 42, fps: 24 },
    {
      segments: [
        { kind: 'scene', scene: 'faceoff', start: 0, duration: 0.5, localDuration: 0.5 },
        { kind: 'scene', scene: 'attack-goal', start: 0.5, duration: 1.0, localDuration: 1.0 },
        { kind: 'outro', scene: 'attack-goal', start: 1.5, duration: 0.5, localDuration: 1.0 },
      ],
    },
  );
  assert.equal(short.duration, 2);
  assert.equal(short.totalFrames, 48);
  const dir = path.join(tmpdir(), 'hnc-template-mp4');
  mkdirSync(dir, { recursive: true });
  const session = await SocialRenderSession.openTemplate(short);
  try {
    for (let frame = 0; frame < short.totalFrames; frame++) {
      await session.screenshotFrame(frame, path.join(dir, `${String(frame).padStart(6, '0')}.png`));
    }
  } finally {
    await session.close();
  }
  const wav = path.join(dir, 'sfx.wav');
  writeFileSync(wav, renderAudioToWav(short.audio, short.seed));
  const out = path.join(dir, 'short.mp4');
  const { resolveFfmpeg: ffmpeg } = await import('../src/encode/ffmpeg.ts');
  const { done } = runFfmpeg(ffmpeg(), buildEncodeArgs({
    fps: short.fps, framePattern: path.join(dir, '%06d.png'), audioPath: wav, output: out,
  }));
  const result = await done;
  assert.equal(result.status, 0, `ffmpeg ok: ${result.stderr.slice(-300)}`);
  const { resolveFfprobe } = await import('../src/encode/ffmpeg.ts');
  const probed = await probeMedia(resolveFfprobe(), out);
  validateMedia(probed, { width: 1080, height: 1920, fps: 24, duration: 2 });
  assert.ok(await hasFaststart(out));
});
