import { isValidCountryCode } from '../../../apps/game/src/city-league/countries';
import { DEFAULT_FORMAT, DEFAULT_SCENE, DEFAULT_SEED, SOCIAL_FORMATS, type SocialFormatId } from './config';

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
 * Compile a spec into its deterministic scene description. For V1 this is
 * the resolved spec itself (scene presets consume it directly); kept as a
 * separate step so a future timeline compiler can hook in here.
 */
export function compileSpec(input: RawFrameInput): ResolvedFrameSpec {
  return resolveSpec(input);
}
