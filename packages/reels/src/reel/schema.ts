import { isValidCountryCode } from '../../../../apps/game/src/city-league/countries';
import { REEL_FORMATS } from './types';
import { MAX_DURATION, MIN_DURATION } from './presets';
import type { ReelSpec, TemplateInput } from './types';

export class ReelSpecError extends Error {}

const TEMPLATE_IDS = ['office-rivalry', 'country-rivalry'] as const;
export type ReelTemplateId = (typeof TEMPLATE_IDS)[number];

const FOOTBALL_MOMENTS = [
  'faceoff',
  'attack-goal',
  'crossbar-chaos',
  'keeper-disaster',
  'cross-header-goal',
] as const;

export function parseTemplateId(v: unknown): ReelTemplateId {
  if (typeof v === 'string' && (TEMPLATE_IDS as readonly string[]).includes(v)) {
    return v as ReelTemplateId;
  }
  throw new ReelSpecError(`Unknown template: ${String(v)} (supported: ${TEMPLATE_IDS.join(', ')})`);
}

export function parseCountry(v: unknown): string {
  if (typeof v === 'string' && isValidCountryCode(v)) return v;
  throw new ReelSpecError(`Unknown country code: ${String(v)}`);
}

export function parseFps(v: unknown): 30 | 60 {
  if (v === undefined || v === null || v === '') return 30;
  if (v === 30 || v === 60) return v;
  throw new ReelSpecError(`Invalid fps: ${String(v)} (supported: 30, 60)`);
}

export function parseSeed(v: unknown): number {
  if (v === undefined || v === null || v === '') return 42;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new ReelSpecError(`Invalid seed: ${String(v)} (expected integer 0..4294967295)`);
  }
  return n;
}

export function parseFootballMoment(v: unknown): string {
  if (v === undefined || v === null || v === '') return 'crossbar-chaos';
  if (typeof v === 'string' && (FOOTBALL_MOMENTS as readonly string[]).includes(v)) return v;
  throw new ReelSpecError(`Unknown football moment: ${String(v)} (supported: ${FOOTBALL_MOMENTS.join(', ')})`);
}

export function parseTemplateInput(v: Record<string, unknown>): TemplateInput {
  const template = parseTemplateId(v['template']);
  const home = parseCountry(v['home']);
  const away = parseCountry(v['away']);
  const seed = parseSeed(v['seed']);
  const fps = parseFps(v['fps']);
  const headline = v['headline'] === undefined ? undefined : String(v['headline']);
  const cta = v['cta'] === undefined ? undefined : String(v['cta']);
  const footballMoment =
    v['footballMoment'] === undefined || v['football-moment'] === undefined
      ? parseFootballMoment(v['footballMoment'] ?? v['football-moment'])
      : parseFootballMoment(v['footballMoment']);
  const mood = v['mood'] === undefined ? undefined : (String(v['mood']) as TemplateInput['mood']);
  return { template, home, away, seed, fps, headline, cta, footballMoment, mood };
}

function checkTextLimit(label: string, v: string | undefined, max: number): void {
  if (v !== undefined && [...v].length > max) {
    throw new ReelSpecError(`${label} is too long (max ${max} characters).`);
  }
}

export function validateReelSpec(spec: ReelSpec): void {
  if (!(spec.format in REEL_FORMATS)) throw new ReelSpecError(`Unknown format: ${String(spec.format)}`);
  if (spec.fps !== 30 && spec.fps !== 60) throw new ReelSpecError(`Invalid fps: ${String(spec.fps)}`);
  if (!Number.isFinite(spec.durationInSeconds) || spec.durationInSeconds < MIN_DURATION || spec.durationInSeconds > MAX_DURATION) {
    throw new ReelSpecError(`Invalid duration: ${String(spec.durationInSeconds)} (range ${MIN_DURATION}..${MAX_DURATION}s)`);
  }
  if (!Number.isInteger(spec.seed) || spec.seed < 0 || spec.seed > 0xffffffff) {
    throw new ReelSpecError(`Invalid seed: ${String(spec.seed)}`);
  }
  if (spec.beats.length === 0) throw new ReelSpecError('Reel must contain at least one beat.');
  const total = spec.beats.reduce((a, b) => a + b.duration, 0);
  if (Math.abs(total - spec.durationInSeconds) > 0.05) {
    throw new ReelSpecError(`Beat durations sum to ${total.toFixed(2)}s but spec duration is ${spec.durationInSeconds}s.`);
  }
  for (const actor of spec.cast ?? []) {
    if (actor.country !== undefined) parseCountry(actor.country);
  }
  checkTextLimit('Headline', spec.captions?.cues?.[0]?.text, 500);
}
