import { isValidCountryCode } from '../../../../apps/game/src/city-league/countries';
import { ASSET_MANIFEST } from '../assets/manifest';
import { ANIMATION_IDS } from '../animation/animation-registry';
import { CAMERA_PRESET_IDS } from '../cameras/registry';
import { TRANSITION_IDS } from '../transitions/registry';
import { EFFECT_IDS } from '../effects/presets';
import { STAGE_IDS } from '../stages/registry';
import { isTimeRampId } from '../animation/time-ramp';
import type { ReelSpec, ShotPlan } from './types';
import { validateReelSpec } from './schema';

export interface ValidationIssue {
  level: 'error' | 'warn';
  message: string;
}

/**
 * Production validator for compiled Reels. Errors block rendering;
 * warnings are creative recommendations.
 */
export function validateProductionReel(spec: ReelSpec, plan: ShotPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    validateReelSpec(spec);
  } catch (e) {
    issues.push({ level: 'error', message: (e as Error).message });
    return issues;
  }
  if (spec.format !== 'instagram-reel' && spec.format !== 'tiktok' && spec.format !== 'youtube-short') {
    issues.push({ level: 'error', message: `Unknown format: ${String(spec.format)}` });
  }
  if (plan.width !== 1080 || plan.height !== 1920) {
    issues.push({ level: 'error', message: `Expected 1080x1920, got ${plan.width}x${plan.height}` });
  }
  const assetIds = new Set(ASSET_MANIFEST.map((a) => a.id));
  const stageIds = new Set([...STAGE_IDS, ...(spec.stages ?? []).map((s) => s.id)]);
  for (const shot of plan.shots) {
    if (!stageIds.has(shot.stage)) {
      issues.push({ level: 'error', message: `Unknown stage id: ${shot.stage} in ${shot.id}` });
    }
    if (shot.camera !== undefined && !(CAMERA_PRESET_IDS as readonly string[]).includes(shot.camera)) {
      issues.push({ level: 'error', message: `Unknown camera preset: ${shot.camera} in ${shot.id}` });
    }
    for (const a of shot.actors ?? []) {
      const actor = (spec.cast ?? []).find((c) => c.id === a.actor);
      if (!actor) {
        issues.push({ level: 'error', message: `Unknown actor: ${a.actor} in ${shot.id}` });
        continue;
      }
      if (!assetIds.has(actor.model) && actor.model !== 'hnc-footballer') {
        // Actor models resolve through the asset manifest OR built-in procedural ids.
        issues.push({ level: 'error', message: `Unknown actor model asset: ${actor.model}` });
      }
      if (a.animation !== undefined && !(ANIMATION_IDS as readonly string[]).includes(a.animation)) {
        issues.push({ level: 'error', message: `Unknown animation id: ${a.animation} in ${shot.id}` });
      }
      if (actor.country !== undefined && !isValidCountryCode(actor.country)) {
        issues.push({ level: 'error', message: `Invalid country code: ${actor.country}` });
      }
    }
    for (const t of [shot.transitionIn, shot.transitionOut]) {
      if (t && !(TRANSITION_IDS as readonly string[]).includes(t.type)) {
        issues.push({ level: 'error', message: `Unknown transition: ${t.type} in ${shot.id}` });
      }
    }
    for (const e of shot.effects ?? []) {
      if (!(EFFECT_IDS as readonly string[]).includes(e.type)) {
        issues.push({ level: 'error', message: `Unknown effect: ${e.type} in ${shot.id}` });
      }
    }
    for (const g of shot.overlays ?? []) {
      if ((g.text ?? '').length > 80) {
        issues.push({ level: 'warn', message: `Overlay text long in ${shot.id}: "${(g.text ?? '').slice(0, 40)}…"` });
      }
    }
    const mc = shot.momentClock;
    if (mc) {
      if (!shot.footballMoment) issues.push({ level: 'error', message: `momentClock without footballMoment in ${shot.id}` });
      if (!(mc.from < mc.to) || mc.from < 0 || mc.to > mc.length) {
        issues.push({ level: 'error', message: `Invalid momentClock ${mc.from}..${mc.to} (length ${mc.length}) in ${shot.id}` });
      }
      if (mc.ramp !== undefined && !isTimeRampId(mc.ramp)) {
        issues.push({ level: 'error', message: `Unknown time ramp: ${mc.ramp} in ${shot.id}` });
      }
    }
    for (const c of [shot.home, shot.away]) {
      if (c !== undefined && !isValidCountryCode(c)) {
        issues.push({ level: 'error', message: `Invalid country code: ${c} in ${shot.id}` });
      }
    }
  }
  // Timeline contiguity: shots must tile [0, totalFrames) with no gaps/overlaps.
  let cursor = 0;
  for (const shot of plan.shots) {
    if (shot.startFrame !== cursor) {
      issues.push({ level: 'error', message: `Timeline gap/overlap at ${shot.id}: expected start ${cursor}, got ${shot.startFrame}` });
    }
    cursor += shot.durationInFrames;
  }
  if (cursor !== plan.totalFrames) {
    issues.push({ level: 'error', message: `Plan covers ${cursor} frames but total is ${plan.totalFrames}` });
  }
  // Clocked shots of one moment should hand over seamlessly (to == next from).
  for (let i = 1; i < plan.shots.length; i++) {
    const a = plan.shots[i - 1];
    const b = plan.shots[i];
    if (a.momentClock && b.momentClock && a.footballMoment === b.footballMoment && Math.abs(a.momentClock.to - b.momentClock.from) > 1e-6) {
      issues.push({ level: 'warn', message: `Moment clock jumps ${a.momentClock.to} -> ${b.momentClock.from} between ${a.id} and ${b.id}` });
    }
  }
  // Marketing templates must end with a CTA + brand.
  const lastOverlays = plan.shots[plan.shots.length - 1]?.overlays ?? [];
  // brand-reveal is a full end card: badge + promise + site.
  const hasCta = lastOverlays.some((g) => g.kind === 'cta' || g.kind === 'headline' || g.kind === 'brand-reveal');
  const hasBrand = lastOverlays.some((g) => g.kind === 'brand' || g.kind === 'brand-reveal');
  if (!hasCta) issues.push({ level: 'warn', message: 'Final shot has no CTA/headline overlay.' });
  if (!hasBrand) issues.push({ level: 'warn', message: 'Final shot has no brand overlay.' });
  // Determinism: total frame count must equal round(duration*fps).
  const expected = Math.round(spec.durationInSeconds * spec.fps);
  if (plan.totalFrames !== expected) {
    issues.push({ level: 'error', message: `Frame count ${plan.totalFrames} != round(${spec.durationInSeconds}*${spec.fps})` });
  }
  return issues;
}

export function assertValidProductionReel(spec: ReelSpec, plan: ShotPlan): void {
  const errors = validateProductionReel(spec, plan).filter((i) => i.level === 'error');
  if (errors.length > 0) {
    throw new Error(`Invalid Reel "${spec.id}":\n${errors.map((e) => `- ${e.message}`).join('\n')}`);
  }
}
