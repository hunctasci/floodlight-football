/**
 * Registered content. Each entry is a plain ContentSpec (JSON-serialisable);
 * the CLI also accepts a spec file path, so new pieces need no registration.
 */
import type { ContentSpec } from '../engine/spec/types';
import { BREAKING_NEWS } from './breaking-news';
import { GROUP_CHAT } from './group-chat';
import { HNC_HERO } from './hnc-hero';
import { OFFICE_RIVALRY } from './office-rivalry';
import { AUTUMN_2026 } from './autumn-2026';

export const CONTENT: Record<string, ContentSpec> = {
  [OFFICE_RIVALRY.id]: OFFICE_RIVALRY,
  [GROUP_CHAT.id]: GROUP_CHAT,
  [BREAKING_NEWS.id]: BREAKING_NEWS,
  [HNC_HERO.id]: HNC_HERO,
  ...Object.fromEntries(AUTUMN_2026.map((s) => [s.id, s])),
};

/** Remotion composition id for a content id ('office-rivalry' → 'OfficeRivalry'). */
export function compositionId(id: string): string {
  return id.replace(/(^|-)([a-z0-9])/g, (_, _d, c: string) => c.toUpperCase());
}
