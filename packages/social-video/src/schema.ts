import { isValidCountryCode } from '../../../apps/game/src/city-league/countries';
import {
  DEFAULT_DURATION, DEFAULT_FORMAT, DEFAULT_FPS, DEFAULT_SCENE, DEFAULT_SEED,
  MAX_DURATION, MAX_FPS, MIN_DURATION, MIN_FPS, SOCIAL_FORMATS, type SocialFormatId,
} from './config';

/**
 * Minimal semantic spec for a social frame. Agents think in scene + country
 * codes + seed; Three.js coordinates live inside scene presets, never here.
 */
export const SOCIAL_SCENES = ['faceoff'] as const;
export type SocialSceneId = (typeof SOCIAL_SCENES)[number];

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

export function parseDuration(v: unknown): number {
  if (v === undefined || v === null || v === '') return DEFAULT_DURATION;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= MIN_DURATION || n > MAX_DURATION) {
    throw new SocialSpecError(`Invalid duration: ${String(v)}. Supported range is (0–${MAX_DURATION}] seconds.`);
  }
  return n;
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
 * presets, never here.
 */
export type SocialVideoSpec = {
  scene: 'faceoff';

  home: string;
  away: string;

  format?: 'reel';

  seed?: number;

  fps?: number;

  duration?: number;
};

/** Raw agent/CLI video input: everything optional and unvalidated. */
export interface RawVideoInput extends RawFrameInput {
  fps?: unknown;
  duration?: unknown;
}

export interface ResolvedVideoSpec extends ResolvedFrameSpec {
  fps: number;
  duration: number;
  totalFrames: number;
}

/**
 * Validate raw input and fill deterministic defaults. Pure: the same input
 * always resolves to the same output; throws SocialSpecError on bad input.
 * Frame count rule: totalFrames = Math.round(duration * fps), so valid
 * frame indices are 0 ... totalFrames - 1.
 */
export function resolveVideoSpec(input: RawVideoInput): ResolvedVideoSpec {
  const base = resolveSpec(input);
  const fps = parseFps(input.fps);
  const duration = parseDuration(input.duration);
  const totalFrames = Math.round(duration * fps);
  return Object.freeze({ ...base, fps, duration, totalFrames });
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
