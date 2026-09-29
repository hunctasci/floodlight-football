/**
 * PosterDef — a static key-art post (default 1080×1350, 4:5). Not a frame
 * grabbed from a reel: plates are renders of dedicated key-art ContentSpecs
 * (same worlds, same people, poster staging), cropped from 9:16 and placed
 * into rects; a typography layer is rendered on top (transparent) and the
 * whole is composited by scripts/poster.ts.
 */
import type { ContentSpec } from '../engine/spec/types';

export interface PosterPlate {
  spec: ContentSpec;
  /** Time in the spec (timing grammar), e.g. 'still@50%'. */
  at: string;
  /** Crop window of the 1080×1920 render: top edge (px). Width is the full 1080 unless `crop.w`. */
  crop?: { y: number; x?: number; w?: number; h?: number };
  /** Destination rect on the poster (default full canvas). */
  rect?: { x: number; y: number; w: number; h: number };
}

export type PosterBlock =
  | { kind: 'text'; style: 'headline' | 'kicker' | 'cinema' | 'monument' | 'dedication' | 'horror' | 'broadcast' | 'typewriter' | 'impact' | 'label'; text: string; x?: number; y: number; w?: number; align?: 'left' | 'center' | 'right'; size?: number; color?: string; lang?: 'tr' }
  | { kind: 'rule'; x: number; y: number; w: number; h: number; color: string }
  | { kind: 'lockup'; y: number; x?: number; align?: 'left' | 'center' | 'right'; tone?: 'light' | 'dark'; scale?: number; line?: string; plate?: boolean }
  | { kind: 'bubble'; text: string; x: number; y: number; size?: number }
  | { kind: 'breaking'; label: string; headline: string; y: number }
  | { kind: 'bug'; text: string }
  | { kind: 'billing'; lines: string[]; y: number };

export interface PosterDef {
  id: string;
  width?: number;
  height?: number;
  /** Canvas colour behind plates (split posters show it as gutters). */
  background?: string;
  plates: PosterPlate[];
  /** Screen-space grade over the plates, under the type. */
  grade?: { vignette?: number; tint?: string; tintAlpha?: number; gradientBottom?: number; gradientTop?: number };
  blocks: PosterBlock[];
  /** Accessible description of the finished image (copy.md ALT TEXT). */
  alt: string;
}
