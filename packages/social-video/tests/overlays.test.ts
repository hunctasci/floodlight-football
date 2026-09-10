import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileVideo, evaluateOverlays } from '../src/timeline.ts';
import { evaluateOverlayFrame, brandPunchScale, fadeInOut, punchScale, slideIn } from '../src/overlays/evaluate.ts';
import { DEFAULT_ATTACK_HEADLINE, DEFAULT_CTA, DEFAULT_FACEOFF_HEADLINE } from '../src/overlays/presets.ts';
import { resolveVideoSpec } from '../src/schema.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const faceoff = (extra: Record<string, unknown> = {}) =>
  compileVideo({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 4, ...extra });

const attackGoal = (extra: Record<string, unknown> = {}) =>
  compileVideo({ scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 30, ...extra });

const kindsAt = (video: ReturnType<typeof faceoff>, frame: number): string[] =>
  evaluateOverlays(video, frame).overlays.map((o) => o.kind).sort();

// ---------------------------------------------------------------------------
// Compilation: default plans
// ---------------------------------------------------------------------------

test('faceoff default overlay plan contains versus + headline', () => {
  const compiled = faceoff();
  const kinds = compiled.overlayPlan.map((e) => e.kind);
  assert.ok(kinds.includes('versus'), 'versus present');
  assert.ok(kinds.includes('headline'), 'headline present');
  assert.deepEqual(kinds, ['versus', 'headline']);
});

test('attack-goal default overlay plan contains versus, goal, headline, cta, brand', () => {
  const compiled = attackGoal();
  const kinds = compiled.overlayPlan.map((e) => e.kind);
  assert.equal(kinds.length, 5);
  for (const kind of ['versus', 'goal', 'headline', 'cta', 'brand']) {
    assert.ok(kinds.includes(kind as never), `${kind} present`);
  }
});

test('versus payload derives canonical country names + flags (no second table)', () => {
  const compiled = faceoff();
  const versus = compiled.overlayPlan.find((e) => e.kind === 'versus')?.versus;
  assert.ok(versus);
  assert.equal(versus.homeCode, 'TR');
  assert.equal(versus.awayCode, 'GR');
  assert.equal(versus.homeName, 'TÜRKIYE');
  assert.equal(versus.awayName, 'GREECE');
  assert.equal(versus.homeFlag, '🇹🇷');
  assert.equal(versus.awayFlag, '🇬🇷');
});

test('goal text is country-specific and derived from the attacking side', () => {
  const home = attackGoal().overlayPlan.find((e) => e.kind === 'goal');
  assert.equal(home?.text, 'TÜRKIYE SCORES!');
  const away = attackGoal({ attackTeam: 'away' }).overlayPlan.find((e) => e.kind === 'goal');
  assert.equal(away?.text, 'GREECE SCORES!');
});

test('--no-overlays compiles to an empty plan', () => {
  const compiled = faceoff({ overlays: 'none' });
  assert.deepEqual(compiled.overlayPlan, []);
  assert.deepEqual(evaluateOverlays(compiled, 90).overlays, []);
});

// ---------------------------------------------------------------------------
// Timing: representative frames
// ---------------------------------------------------------------------------

test('faceoff overlay timing across 0/15/45/90/119', () => {
  const compiled = faceoff();
  assert.deepEqual(kindsAt(compiled, 0), [], 'frame 0: stadium establishes, no text');
  assert.deepEqual(kindsAt(compiled, 15), ['versus'], 'frame 15 (0.5s): rivalry title');
  assert.deepEqual(kindsAt(compiled, 45), ['versus'], 'frame 45 (1.5s): rivalry title holds');
  assert.deepEqual(kindsAt(compiled, 90), ['headline'], 'frame 90 (3.0s): hero headline');
  assert.deepEqual(kindsAt(compiled, 119), ['headline'], 'frame 119: hero frame');
});

test('attack-goal overlay timing across 0/30/110/120/150/170/179', () => {
  const compiled = attackGoal();
  assert.deepEqual(kindsAt(compiled, 0), ['versus'], 'frame 0: compact context strip');
  assert.deepEqual(kindsAt(compiled, 30), ['versus'], 'frame 30 (1.0s): strip holds');
  assert.deepEqual(kindsAt(compiled, 110), ['goal'], 'frame 110 (3.67s): goal punch');
  assert.deepEqual(kindsAt(compiled, 120), ['goal'], 'frame 120 (4.0s): goal holds');
  assert.deepEqual(kindsAt(compiled, 150), ['headline'], 'frame 150 (5.0s): celebration headline');
  assert.deepEqual(kindsAt(compiled, 170), ['brand', 'cta'], 'frame 170 (5.67s): end card');
  assert.deepEqual(kindsAt(compiled, 179), ['brand', 'cta'], 'frame 179: end card holds');
});

test('goal overlay does not leak into the shot flight or the celebration', () => {
  const compiled = attackGoal();
  assert.ok(!kindsAt(compiled, 105).includes('goal'), 'frame 105 (shot flying): no goal text yet');
  assert.ok(!kindsAt(compiled, 150).includes('goal'), 'frame 150 (celebration): goal text gone');
});

test('trailing overlays hold full opacity on the final frame (usable end card)', () => {
  const fo = evaluateOverlays(faceoff(), 119).overlays.find((o) => o.kind === 'headline');
  assert.ok(fo && fo.opacity > 0.9, `faceoff hero frame holds (opacity=${fo?.opacity})`);
  const ag = evaluateOverlays(attackGoal(), 179);
  for (const kind of ['cta', 'brand'] as const) {
    const ov = ag.overlays.find((o) => o.kind === kind);
    assert.ok(ov && ov.opacity > 0.9, `attack-goal ${kind} holds on frame 179 (opacity=${ov?.opacity})`);
  }
});

// ---------------------------------------------------------------------------
// Random access + determinism (no browser)
// ---------------------------------------------------------------------------

test('overlay evaluation is random-access: frame 170 deep-equals after other frames', () => {
  const compiled = attackGoal();
  const direct = evaluateOverlays(compiled, 170);
  for (const f of [0, 30, 110, 120, 150, 179, 40, 20]) evaluateOverlays(compiled, f);
  assert.deepEqual(evaluateOverlays(compiled, 170), direct);
});

test('compile/evaluate twice with the same spec deep-equals', () => {
  const a = attackGoal();
  const b = attackGoal();
  assert.deepEqual(a.overlayPlan, b.overlayPlan);
  for (const frame of [0, 30, 110, 120, 150, 170, 179]) {
    assert.deepEqual(evaluateOverlays(a, frame), evaluateOverlays(b, frame));
  }
  const c = faceoff();
  const d = faceoff();
  for (const frame of [0, 15, 45, 90, 119]) {
    assert.deepEqual(evaluateOverlays(c, frame), evaluateOverlays(d, frame));
  }
});

test('evaluated overlay values are absolute and bounded', () => {
  const compiled = attackGoal();
  for (const frame of [0, 110, 150, 170]) {
    for (const ov of evaluateOverlays(compiled, frame).overlays) {
      assert.ok(ov.opacity >= 0 && ov.opacity <= 1, `opacity bounded at frame ${frame}`);
      assert.ok(Number.isFinite(ov.scale) && Number.isFinite(ov.translateX) && Number.isFinite(ov.translateY));
    }
  }
  // Goal punch starts small, overshoots, then settles at 1.
  assert.ok(punchScale(0) < 0.8, 'punch starts small');
  assert.ok(punchScale(0.15) > 1.05, 'punch overshoots');
  assert.equal(punchScale(1.0), 1.0, 'punch settles');
  assert.equal(fadeInOut(-1, 0, 1, 0.25, 0.25), 0);
  assert.equal(slideIn(99, 0, 0.25, 30), 0, 'slide settles at 0');
});

// ---------------------------------------------------------------------------
// Custom copy
// ---------------------------------------------------------------------------

test('custom headline and CTA survive compilation exactly', () => {
  const compiled = attackGoal({ headline: 'ONE WIN FROM #1', cta: 'PLAY FOR TÜRKİYE' });
  assert.equal(compiled.headline, 'ONE WIN FROM #1');
  assert.equal(compiled.cta, 'PLAY FOR TÜRKİYE');
  const headline = compiled.overlayPlan.find((e) => e.kind === 'headline');
  assert.equal(headline?.text, 'ONE WIN FROM #1');
  const cta = compiled.overlayPlan.find((e) => e.kind === 'cta');
  assert.equal(cta?.text, 'PLAY FOR TÜRKİYE');
  // Evaluated frames carry the exact text too.
  const at150 = evaluateOverlays(compiled, 150).overlays.find((o) => o.kind === 'headline');
  assert.equal(at150?.text, 'ONE WIN FROM #1');
  const at170 = evaluateOverlays(compiled, 170).overlays.find((o) => o.kind === 'cta');
  assert.equal(at170?.text, 'PLAY FOR TÜRKİYE');
});

test('defaults apply when no custom copy is given', () => {
  const goal = attackGoal();
  assert.equal(goal.overlayPlan.find((e) => e.kind === 'headline')?.text, DEFAULT_ATTACK_HEADLINE);
  assert.equal(goal.overlayPlan.find((e) => e.kind === 'cta')?.text, DEFAULT_CTA);
  assert.equal(faceoff().overlayPlan.find((e) => e.kind === 'headline')?.text, DEFAULT_FACEOFF_HEADLINE);
});

test('Unicode, emoji, apostrophes and secondary copy survive exactly', () => {
  const compiled = faceoff({ headline: "C'EST LE FOOT ⚽", secondary: 'Türkiye vs Greece 🇹🇷🇬🇷' });
  const headline = compiled.overlayPlan.find((e) => e.kind === 'headline');
  assert.equal(headline?.text, "C'EST LE FOOT ⚽");
  assert.equal(headline?.secondary, 'Türkiye vs Greece 🇹🇷🇬🇷');
  const at90 = evaluateOverlays(compiled, 90).overlays.find((o) => o.kind === 'headline');
  assert.equal(at90?.text, "C'EST LE FOOT ⚽");
  assert.equal(at90?.secondary, 'Türkiye vs Greece 🇹🇷🇬🇷');
});

test('injection copy stays literal in the plan (DOM renders it via textContent)', () => {
  const evil = '<script>alert(1)</script>';
  const compiled = faceoff({ headline: evil });
  assert.equal(compiled.overlayPlan.find((e) => e.kind === 'headline')?.text, evil);
  const at90 = evaluateOverlays(compiled, 90).overlays.find((o) => o.kind === 'headline');
  assert.equal(at90?.text, evil);
  const domSrc = readFileSync(path.join(HERE, '../src/overlays/render-dom.ts'), 'utf8');
  assert.ok(!domSrc.includes('.innerHTML'), 'overlay DOM renderer never uses innerHTML');
  assert.ok(domSrc.includes('textContent'), 'overlay copy is set as text');
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('overlong headline/secondary/CTA fail explicitly, never silently truncated', () => {
  assert.throws(
    () => resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', headline: 'x'.repeat(49) }),
    /Headline is too long \(max 48 characters\)\./,
  );
  assert.throws(
    () => resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', secondary: 'x'.repeat(81) }),
    /Secondary is too long \(max 80 characters\)\./,
  );
  assert.throws(
    () => resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', cta: 'x'.repeat(49) }),
    /CTA is too long \(max 48 characters\)\./,
  );
  // Boundary lengths are accepted.
  assert.equal(resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', headline: 'x'.repeat(48) }).headline, 'x'.repeat(48));
  assert.equal(resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', cta: 'x'.repeat(48) }).cta, 'x'.repeat(48));
});

test('empty explicit copy fails instead of rendering blank layers', () => {
  assert.throws(
    () => resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', headline: '' }),
    /Headline must not be empty\./,
  );
  assert.throws(
    () => resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', cta: '   ' }),
    /CTA must not be empty\./,
  );
});

test('unknown overlays mode fails clearly; default is default', () => {
  assert.equal(resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR' }).overlays, 'default');
  assert.throws(
    () => resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', overlays: 'fancy' }),
    /Unknown overlays mode: fancy/,
  );
});

test('overlay styles never use CSS animations or transitions as a timeline', () => {
  const css = readFileSync(path.join(HERE, '../src/overlays/styles.css'), 'utf8');
  assert.ok(!css.includes('animation'), 'no CSS animation in overlay styles');
  assert.ok(!css.includes('transition'), 'no CSS transition in overlay styles');
  assert.ok(!css.includes('@keyframes'), 'no keyframes in overlay styles');
});

test('brand overlay references the canonical retro logo with a text fallback', () => {
  const domSrc = readFileSync(path.join(HERE, '../src/overlays/render-dom.ts'), 'utf8');
  assert.ok(domSrc.includes('hnc-retro-v2.png'), 'brand uses the canonical retro logo asset path');
  assert.ok(domSrc.includes('HNC LEAGUE'), 'styled-text fallback lockup exists for unreadable art');
  assert.ok(domSrc.includes('getImageData'), 'logo file is pixel-validated, never trusted on load alone');
});

test('overlay evaluation needs no browser: evaluateOverlayFrame is pure', () => {
  const compiled = attackGoal();
  const a = evaluateOverlayFrame(compiled.overlayPlan, 170, compiled.fps);
  assert.equal(a.frame, 170);
  assert.equal(a.time, 170 / 30);
  assert.deepEqual(a, evaluateOverlayFrame(compiled.overlayPlan, 170, compiled.fps));
});

test('brand punch is deterministic: 0.75 → 1.06 → 1.0 with opacity, no CSS', () => {
  assert.ok(Math.abs(brandPunchScale(-0.1) - 0.75) < 1e-9, 'pre-entry rests at 0.75');
  assert.ok(Math.abs(brandPunchScale(0) - 0.75) < 1e-9, 'entry starts at 0.75');
  assert.ok(brandPunchScale(0.2) > 1.05 && brandPunchScale(0.2) <= 1.061, `punch peaks ~1.06 (got ${brandPunchScale(0.2)})`);
  assert.equal(brandPunchScale(0.45), 1.0, 'settles at 1.0 by 0.45s');
  assert.equal(brandPunchScale(1.5), 1.0, 'holds at 1.0');
  // Brand entries evaluate with punch scale, zero slide, bounded opacity.
  const compiled = attackGoal();
  const brandAt = (frame: number) => evaluateOverlays(compiled, frame).overlays.find((o) => o.kind === 'brand');
  const early = brandAt(162); // 5.4s, just after 5.35 start → entering
  assert.ok(early, 'brand active just after entry');
  assert.ok(early.scale >= 0.74 && early.scale <= 1.07, `punch scale bounded (got ${early.scale})`);
  assert.equal(early.translateX, 0);
  assert.equal(early.translateY, 0, 'badge punches in place, no slide');
  const held = brandAt(179);
  assert.ok(held && Math.abs(held.scale - 1.0) < 1e-9, 'brand holds at 1.0');
  assert.ok(held.opacity > 0.9, 'brand holds opacity');
});

test('brand badge is large, transparent, and box-free (trailer end card)', () => {
  const css = readFileSync(path.join(HERE, '../src/overlays/styles.css'), 'utf8');
  const logoBlock = css.slice(css.indexOf('.hnc-ov-logo'));
  assert.ok(logoBlock.includes('width: 500px'), 'badge visual width ~500px');
  assert.ok(logoBlock.includes('height: 500px'), 'badge square holds details');
  assert.ok(logoBlock.includes('background: transparent'), 'no background plate behind the badge');
  assert.ok(logoBlock.includes('border: none'), 'no bordered card around the badge');
  assert.ok(logoBlock.includes('box-shadow: none'), 'no SaaS panel shadow on the image element');
  assert.ok(logoBlock.includes('drop-shadow'), 'subtle drop/block shadow for separation');
  assert.ok(css.includes('.hnc-ov-scrim'), 'cinematic separation uses a scrim, not a box');
  assert.ok(css.includes('radial-gradient'), 'radial darkening behind the logo');
  // The badge element itself must not draw a visible box.
  const brandRule = css.slice(css.indexOf('.hnc-ov-brand {'), css.indexOf('.hnc-ov-brand {') + 400);
  assert.ok(!brandRule.includes('border:'), 'brand container draws no border');
  assert.ok(!brandRule.includes('background: #'), 'brand container draws no solid plate');
});

test('brand DOM owns scrim + badge, CTA owns headline + domain (badge/CTA/domain hierarchy)', () => {
  const domSrc = readFileSync(path.join(HERE, '../src/overlays/render-dom.ts'), 'utf8');
  assert.ok(domSrc.includes('hnc-ov-scrim'), 'full-frame cinematic scrim exists');
  assert.ok(domSrc.includes('hnc-ov-brand-stack'), 'badge punch targets an inner stack so the scrim never scales');
  assert.ok(domSrc.includes('querySelector'), 'brand transform is split: scrim fades, stack punches');
  // CTA carries the support line so the small domain text never scales with the badge punch.
  const ctaIdx = domSrc.indexOf('function buildCta');
  assert.ok(ctaIdx >= 0, 'CTA builder exists');
  const ctaBlock = domSrc.slice(ctaIdx, ctaIdx + 800);
  assert.ok(ctaBlock.includes('hnc-ov-domain'), 'domain renders with the CTA, below the headline');
  assert.ok(ctaBlock.includes('BRAND_DOMAIN'), 'domain stays canonical hncleague.com');
});

test('no raw layout controls leak into the AI-facing public spec', () => {
  const schemaSrc = readFileSync(path.join(HERE, '../src/schema.ts'), 'utf8');
  for (const banned of ['logoWidth', 'logoTop', 'logoSize', 'brandScale', 'logoLeft']) {
    assert.ok(!schemaSrc.includes(banned), `public spec exposes no ${banned}`);
  }
  const spec = resolveVideoSpec({ scene: 'attack-goal', home: 'TR', away: 'GR' });
  assert.ok(!('logoWidth' in spec) && !('logoTop' in spec), 'resolved spec carries copy only');
});
