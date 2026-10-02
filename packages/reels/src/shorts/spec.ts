/**
 * HNC short-form shell — reusable spec for TikTok / Instagram Reels (9:16).
 *
 * Concept: HOOK → CONTENT → PUNCHLINE → CTA, 8–25 s. Longer films stay in
 * Player Diaries; this is the high-frequency system. Remotion owns hook / CTA /
 * captions / overlays; Blender supplies plates (characters, environment, gags).
 */
export const SHORT_SCHEMA = 'hnc-short/1';

export interface ShortVoiceRef {
  /** Stable registry id, e.g. "HNC-NARRATOR-01". Resolved via voices/registry.json. */
  voiceId: string;
  /** Spoken text (may differ from on-screen headline). */
  text: string;
  /** Per-line delivery note, e.g. "fast, playful, confident". Identity stays in the registry. */
  delivery?: string;
  /** Pronunciation override; captions keep `text`. */
  say?: string;
  /** Seconds from the short's zero. Hook voices start ~0.05–0.15 s. */
  at?: number;
  /** Optional per-line tempo multiplier (Qwen apply_tempo). Default = registry tempo. */
  tempo?: number;
}

export interface ShortHook {
  headline: string;
  subline?: string;
  voice?: ShortVoiceRef;
  /** Seconds on screen. Target the first 1–1.5 s. */
  duration: number;
}

export interface ShortScene {
  id: string;
  duration: number;
  /** Remotion-only colour/graphic, or a Blender plate under Remotion overlays. */
  visual:
    | { kind: 'color'; color: string }
    | { kind: 'plate'; src: string };
  voice?: ShortVoiceRef;
  overlay?: string;
}

export interface ShortCta {
  headline: string;
  subline?: string;
  voice?: ShortVoiceRef;
  showUrl?: boolean;
  duration: number;
}

export interface ShortSpec {
  schema: typeof SHORT_SCHEMA;
  id: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  hook: ShortHook;
  scenes: ShortScene[];
  cta: ShortCta;
}

export function shortDuration(spec: ShortSpec): number {
  return spec.hook.duration + spec.scenes.reduce((n, s) => n + s.duration, 0) + spec.cta.duration;
}

/** Frames per segment, Python-round compatible (halves to even) like diaries/edit.ts. */
export function shortFrames(dur: number, fps: number): number {
  const x = dur * fps;
  const f = Math.floor(x);
  const r = x - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(x);
  return Math.max(1, r);
}

/** Minimal structural check for the CLI (`shorts check`). */
export function checkShort(spec: ShortSpec): string[] {
  const errs: string[] = [];
  if (spec.schema !== SHORT_SCHEMA) errs.push(`schema must be ${SHORT_SCHEMA}`);
  if (!spec.id) errs.push('id is required');
  if (spec.fps !== 30 && spec.fps !== 60) errs.push(`fps ${spec.fps} should be 30 or 60`);
  if (spec.width !== 1080 || spec.height !== 1920) errs.push('shorts are 1080x1920');
  if (spec.hook.duration < 0.8 || spec.hook.duration > 2.5) errs.push(`hook.duration ${spec.hook.duration}s: keep 1–1.5 s`);
  if (!spec.hook.headline) errs.push('hook.headline is required');
  const total = shortDuration(spec);
  if (total < 2 || total > 40) errs.push(`total ${total.toFixed(2)}s looks off for a short`);
  const hookAt = spec.hook.voice?.at ?? 0.08;
  if (hookAt > 0.3) errs.push(`hook voice at=${hookAt}s: start ~0.05–0.15 s, never a silent 1 s intro`);
  if (spec.cta.duration > 2.5) errs.push(`cta.duration ${spec.cta.duration}s: keep ~0.8–1.5 s`);
  return errs;
}
