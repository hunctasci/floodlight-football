import { isValidCountryCode } from '../../../apps/game/src/city-league/countries';
import {
  DEFAULT_FORMAT, DEFAULT_FPS, DEFAULT_SCENE, DEFAULT_SEED,
  MAX_DURATION, MAX_FPS, MIN_DURATION, MIN_FPS, SCENE_DEFAULT_DURATION, SOCIAL_FORMATS, type SocialFormatId,
} from './config';
import { templateDuration } from './templates/presets';

/**
 * Minimal semantic spec for a social frame. Agents think in scene + country
 * codes + seed; Three.js coordinates live inside scene presets, never here.
 */
export const SOCIAL_SCENES = ['faceoff', 'attack-goal', 'cross-header-goal', 'crossbar-chaos', 'keeper-disaster'] as const;
export type SocialSceneId = (typeof SOCIAL_SCENES)[number];

/** Production templates composing scenes into finished Reels (one for now). */
export const SOCIAL_TEMPLATES = ['country-rivalry-reel'] as const;
export type TemplateId = (typeof SOCIAL_TEMPLATES)[number];

/** Which side stages the attack in action scenes. */
export const ATTACK_TEAMS = ['home', 'away'] as const;
export type AttackTeam = (typeof ATTACK_TEAMS)[number];

/** Overlay layer mode: default marketing layers or clean 3D only. */
export const OVERLAY_MODES = ['default', 'none'] as const;
export type OverlayMode = (typeof OVERLAY_MODES)[number];

/** Character budgets for AI-supplied overlay copy (code points, not UTF-16). */
export const HEADLINE_MAX = 48;
export const SECONDARY_MAX = 80;
export const CTA_MAX = 48;

/** Semantic attacking lanes; coordinates stay inside scene presets. */
export const ATTACK_STYLES = ['central', 'wing', 'counter'] as const;
export type AttackStyle = (typeof ATTACK_STYLES)[number];

export interface SocialFrameSpec {
  scene: SocialSceneId;
  home: string;
  away: string;
  format?: SocialFormatId;
  seed?: number;
}

/** Raw agent/CLI input: everything optional and unvalidated. */
export interface RawFrameInput {
  scene?: unknown;
  home?: unknown;
  away?: unknown;
  format?: unknown;
  seed?: unknown;
}

export interface ResolvedFrameSpec {
  scene: SocialSceneId;
  home: string;
  away: string;
  format: SocialFormatId;
  seed: number;
  width: number;
  height: number;
  pixelRatio: number;
}

export class SocialSpecError extends Error {}

export function parseScene(v: unknown): SocialSceneId {
  if (v === undefined || v === null || v === '') return DEFAULT_SCENE as SocialSceneId;
  if (typeof v === 'string' && (SOCIAL_SCENES as readonly string[]).includes(v)) return v as SocialSceneId;
  throw new SocialSpecError(`Unknown scene: ${String(v)} (supported: ${SOCIAL_SCENES.join(', ')})`);
}

export function parseTemplate(v: unknown): TemplateId | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string' && (SOCIAL_TEMPLATES as readonly string[]).includes(v)) return v as TemplateId;
  throw new SocialSpecError(`Unknown template: ${String(v)} (supported: ${SOCIAL_TEMPLATES.join(', ')})`);
}

function parseCountry(v: unknown): string {
  if (typeof v === 'string' && isValidCountryCode(v)) return v;
  throw new SocialSpecError(`Unknown country code: ${String(v)}`);
}

export function parseFormat(v: unknown): SocialFormatId {
  if (v === undefined || v === null || v === '') return DEFAULT_FORMAT;
  if (typeof v === 'string' && v in SOCIAL_FORMATS) return v as SocialFormatId;
  throw new SocialSpecError(`Unknown format: ${String(v)} (supported: ${Object.keys(SOCIAL_FORMATS).join(', ')})`);
}

export function parseSeed(v: unknown): number {
  if (v === undefined || v === null || v === '') return DEFAULT_SEED;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new SocialSpecError(`Invalid seed: ${String(v)} (expected an integer 0..4294967295)`);
  }
  return n;
}

export function parseFps(v: unknown): number {
  if (v === undefined || v === null || v === '') return DEFAULT_FPS;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < MIN_FPS || n > MAX_FPS) {
    throw new SocialSpecError(`Invalid fps: ${String(v)}. Supported range is ${MIN_FPS}–${MAX_FPS}.`);
  }
  return n;
}

export function parseDuration(v: unknown, fallback: number = SCENE_DEFAULT_DURATION.faceoff): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= MIN_DURATION || n > MAX_DURATION) {
    throw new SocialSpecError(`Invalid duration: ${String(v)}. Supported range is (0–${MAX_DURATION}] seconds.`);
  }
  return n;
}

export function parseAttackTeam(v: unknown): AttackTeam {
  if (v === undefined || v === null || v === '') return 'home';
  if (typeof v === 'string' && (ATTACK_TEAMS as readonly string[]).includes(v)) return v as AttackTeam;
  throw new SocialSpecError(`Unknown attack team: ${String(v)} (supported: ${ATTACK_TEAMS.join(', ')})`);
}

export function parseAttackStyle(v: unknown): AttackStyle {
  if (v === undefined || v === null || v === '') return 'central';
  if (typeof v === 'string' && (ATTACK_STYLES as readonly string[]).includes(v)) return v as AttackStyle;
  throw new SocialSpecError(`Unknown attack style: ${String(v)} (supported: ${ATTACK_STYLES.join(', ')})`);
}

export function parseOverlays(v: unknown): OverlayMode {
  if (v === undefined || v === null || v === '') return 'default';
  if (typeof v === 'string' && (OVERLAY_MODES as readonly string[]).includes(v)) return v as OverlayMode;
  throw new SocialSpecError(`Unknown overlays mode: ${String(v)} (supported: ${OVERLAY_MODES.join(', ')})`);
}

function copyLength(text: string): number {
  return [...text].length;
}

function parseCopyField(v: unknown, label: string, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') {
    throw new SocialSpecError(`${label} must be a string.`);
  }
  if (v.trim().length === 0) {
    throw new SocialSpecError(`${label} must not be empty.`);
  }
  if (copyLength(v) > max) {
    throw new SocialSpecError(`${label} is too long (max ${max} characters).`);
  }
  return v;
}

export function parseHeadline(v: unknown): string | undefined {
  return parseCopyField(v, 'Headline', HEADLINE_MAX);
}

export function parseSecondary(v: unknown): string | undefined {
  return parseCopyField(v, 'Secondary', SECONDARY_MAX);
}

export function parseCta(v: unknown): string | undefined {
  return parseCopyField(v, 'CTA', CTA_MAX);
}

/**
 * Validate a frame index against a compiled frame count. Returns the index
 * unchanged; throws a clear error when out of range.
 */
export function parseFrameIndex(v: unknown, totalFrames: number, fps: number, duration: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n >= totalFrames) {
    throw new SocialSpecError(
      `Invalid frame: ${String(v)}. Valid range is 0–${totalFrames - 1} for ${fps} FPS × ${duration} sec (${totalFrames} frames).`,
    );
  }
  return n;
}

/**
 * Validate raw input and fill deterministic defaults. Pure: the same input
 * always resolves to the same output; throws SocialSpecError on bad input.
 */
export function resolveSpec(input: RawFrameInput): ResolvedFrameSpec {
  const scene = parseScene(input.scene);
  const home = parseCountry(input.home);
  const away = parseCountry(input.away);
  const format = parseFormat(input.format);
  const seed = parseSeed(input.seed);
  const size = SOCIAL_FORMATS[format];
  return Object.freeze({
    scene, home, away, format, seed,
    width: size.width, height: size.height, pixelRatio: size.pixelRatio,
  });
}

/**
 * Minimal semantic spec for a social video. Agents think in scene + country
 * codes + seed + fps/duration; Three.js coordinates live inside scene
 * presets, never here. Exactly one of `scene` / `template` may be given.
 */
export type SocialVideoSpec = {
  scene: 'faceoff' | 'attack-goal' | 'cross-header-goal' | 'crossbar-chaos' | 'keeper-disaster';

  /** Production template composing scenes (alternative to `scene`). */
  template?: 'country-rivalry-reel';

  home: string;
  away: string;

  format?: 'reel';

  seed?: number;

  fps?: number;

  duration?: number;

  /** Action scenes only: which side stages the attack (default home). */
  attackTeam?: 'home' | 'away';

  /** Action scenes only: semantic attacking lane (default central). */
  attackStyle?: 'central' | 'wing' | 'counter';

  /**
   * Semantic overlay copy overrides. The system owns all styling; these are
   * plain text only (never HTML/CSS). Omitted = scene default copy.
   */
  headline?: string;

  /** Optional supporting line rendered with the headline. */
  secondary?: string;

  /** Call-to-action line for the end card. */
  cta?: string;

  /** Overlay layer switch: 'default' renders marketing layers, 'none' is clean 3D. */
  overlays?: 'default' | 'none';
};

/** Raw agent/CLI video input: everything optional and unvalidated. */
export interface RawVideoInput extends RawFrameInput {
  template?: unknown;
  fps?: unknown;
  duration?: unknown;
  attackTeam?: unknown;
  attackStyle?: unknown;
  headline?: unknown;
  secondary?: unknown;
  cta?: unknown;
  overlays?: unknown;
}

export interface ResolvedVideoSpec extends ResolvedFrameSpec {
  /** Production template (undefined = direct single-scene render). */
  template: TemplateId | undefined;
  fps: number;
  duration: number;
  totalFrames: number;
  attackTeam: AttackTeam;
  attackStyle: AttackStyle;
  /** Overlay layer switch (default 'default'). */
  overlays: OverlayMode;
  /** Custom copy overrides (undefined = scene default). Exact text preserved. */
  headline?: string;
  secondary?: string;
  cta?: string;
}

/**
 * Validate raw input and fill deterministic defaults. Pure: the same input
 * always resolves to the same output; throws SocialSpecError on bad input.
 * Duration defaults per scene (faceoff 4s, attack-goal 6s); explicit
 * --duration always wins. Frame count rule: totalFrames =
 * Math.round(duration * fps), so valid frame indices are 0 ... totalFrames - 1.
 */
export function resolveVideoSpec(input: RawVideoInput): ResolvedVideoSpec {
  const template = parseTemplate(input.template);
  const sceneGiven = input.scene !== undefined && input.scene !== null && input.scene !== '';
  if (template !== undefined && sceneGiven) {
    throw new SocialSpecError('Specify either scene or template, not both.');
  }
  if (template !== undefined && input.duration !== undefined && input.duration !== null && input.duration !== '') {
    throw new SocialSpecError(`Duration is defined by the template (${template}) and cannot be overridden.`);
  }
  const base = resolveSpec(input);
  const fps = parseFps(input.fps);
  const duration = template !== undefined ? templateDuration(template) : parseDuration(input.duration, SCENE_DEFAULT_DURATION[base.scene]);
  const totalFrames = Math.round(duration * fps);
  const attackTeam = parseAttackTeam(input.attackTeam);
  const attackStyle = parseAttackStyle(input.attackStyle);
  const overlays = parseOverlays(input.overlays);
  const headline = parseHeadline(input.headline);
  const secondary = parseSecondary(input.secondary);
  const cta = parseCta(input.cta);
  return Object.freeze({ ...base, template, fps, duration, totalFrames, attackTeam, attackStyle, overlays, headline, secondary, cta });
}

/**
 * Compile a single-frame spec into its deterministic scene description.
 * Kept for backwards compatibility (V1 single-frame path); the timeline
 * compiler (`compileVideo`) is the primary entry point going forward.
 */
export function compileSpec(input: RawFrameInput): ResolvedFrameSpec {
  return resolveSpec(input);
}

/** Canonical timeline clock: time in seconds is always frame / fps. */
export function frameTime(frame: number, fps: number): number {
  return frame / fps;
}
