import { compileVideo } from '../timeline';
import {
  resolveVideoSpec, type RawVideoInput, type ResolvedVideoSpec,
} from '../schema';
import { attackGoalOverlayPlan, faceoffOverlayPlan, DEFAULT_CTA } from '../overlays/presets';
import type { OverlayPlanEntry } from '../overlays/types';
import { countryRivalrySegments, templateTableDuration, type TemplateSegmentDef } from './presets';
import { compileTemplateAudio } from './audio';
import type { CompiledSegment, CompiledTemplate } from './types';

/**
 * Template compiler: composes existing scene compilers into one global
 * timeline. Scenes are reused, never duplicated — each segment holds a
 * scene video compiled with scene-local timing, and the template owns the
 * global overlay plan plus the outro CTA/brand.
 */

/** Internal test fixture: shortened segment tables (never CLI surface). */
export interface TemplateCompileOverrides {
  segments?: TemplateSegmentDef[];
}

function compileSegmentVideo(
  resolved: ResolvedVideoSpec,
  scene: 'faceoff' | 'attack-goal',
  localDuration: number,
): CompiledSegment['video'] {
  // Segment scenes render clean 3D (overlays: none): the template owns the
  // single global overlay plan, so scene CTA/brand can never double-render.
  return compileVideo({
    scene,
    home: resolved.home,
    away: resolved.away,
    format: resolved.format,
    seed: resolved.seed,
    fps: resolved.fps,
    duration: localDuration,
    attackTeam: resolved.attackTeam,
    attackStyle: resolved.attackStyle,
    overlays: 'none',
  });
}

/**
 * Global overlay plan in template seconds. Scene entries keep scene-owned
 * timing/copy, shifted into place: faceoff versus as-is, its headline
 * retimed for the short intro cut (hold resolves into the cut); attack-goal
 * content-only (goal + headline, scene CTA/brand filtered); template owns
 * the outro CTA + brand hold.
 */
function templateOverlayPlan(
  resolved: ResolvedVideoSpec,
  defs: TemplateSegmentDef[],
): OverlayPlanEntry[] {
  if (resolved.overlays === 'none') return [];
  const face = defs.find((d) => d.scene === 'faceoff');
  const attack = defs.find((d) => d.kind === 'scene' && d.scene === 'attack-goal');
  const outro = defs.find((d) => d.kind === 'outro');
  if (!face || !attack || !outro) throw new Error('Template table must stage faceoff, attack and outro segments');
  const entries: OverlayPlanEntry[] = [];
  const faceEnd = face.start + face.duration;
  for (const e of faceoffOverlayPlan({ home: resolved.home, away: resolved.away, attackTeam: resolved.attackTeam })) {
    if (e.kind === 'headline') {
      // Custom headlines belong to later segments; the intro always closes
      // on the default rivalry line. It holds at full strength into the
      // hard cut: the fade-out tail extends past the segment end (where no
      // frame of this segment is ever evaluated), so the final intro frame
      // never catches a fade.
      entries.push({ ...e, start: face.start + Math.max(0.1, face.duration - 0.7), end: faceEnd + 0.3 });
    } else {
      entries.push({ ...e, start: e.start + face.start, end: Math.min(e.end, faceEnd) });
    }
  }
  for (const e of attackGoalOverlayPlan({
    home: resolved.home,
    away: resolved.away,
    attackTeam: resolved.attackTeam,
    headline: resolved.headline,
    secondary: resolved.secondary,
  })) {
    if (e.kind === 'cta' || e.kind === 'brand') continue;
    entries.push({ ...e, start: e.start + attack.start, end: e.end + attack.start });
  }
  const ctaStart = outro.start + 0.2;
  entries.push({ kind: 'cta', start: ctaStart, end: 99, text: resolved.cta ?? DEFAULT_CTA });
  entries.push({ kind: 'brand', start: ctaStart, end: 99 });
  return Object.freeze(entries.map((entry) => Object.freeze(entry))) as OverlayPlanEntry[];
}

/**
 * Compile raw agent/CLI input into a deterministic production template.
 * Pure: same input → same segments, overlays and audio.
 */
export function compileTemplate(input: RawVideoInput, overrides?: TemplateCompileOverrides): CompiledTemplate {
  const resolved = resolveVideoSpec(input);
  if (resolved.template !== 'country-rivalry-reel') {
    throw new Error(`Unsupported template: ${String(resolved.template)}`);
  }
  const defs = overrides?.segments ?? countryRivalrySegments();
  const duration = templateTableDuration(defs);
  const totalFrames = Math.round(duration * resolved.fps);
  const segments: CompiledSegment[] = defs.map((d) => ({
    kind: d.kind,
    scene: d.scene,
    start: d.start,
    duration: d.duration,
    localDuration: d.localDuration,
    video: compileSegmentVideo(resolved, d.scene, d.localDuration),
  }));
  const audio = compileTemplateAudio({
    home: resolved.home,
    away: resolved.away,
    seed: resolved.seed,
    attackTeam: resolved.attackTeam,
    attackStyle: resolved.attackStyle,
    segments: defs,
    totalDuration: duration,
  });
  return Object.freeze({
    template: resolved.template,
    home: resolved.home,
    away: resolved.away,
    format: resolved.format,
    seed: resolved.seed,
    width: resolved.width,
    height: resolved.height,
    pixelRatio: resolved.pixelRatio,
    fps: resolved.fps,
    duration,
    totalFrames,
    attackTeam: resolved.attackTeam,
    attackStyle: resolved.attackStyle,
    overlaysMode: resolved.overlays,
    headline: resolved.headline,
    secondary: resolved.secondary,
    cta: resolved.cta,
    segments: Object.freeze(segments),
    overlayPlan: templateOverlayPlan(resolved, defs),
    audio,
  });
}
