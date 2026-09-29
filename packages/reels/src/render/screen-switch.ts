import type { Shot, Timeline } from '../engine/timeline/types';

/**
 * Current content of an in-world screen: the latest `screen` graphic of the
 * shot's scene that has started (optionally for one `surface`), else the
 * fallback. Lets one beat switch a monitor and later beats keep it.
 */
export function screenAt(tl: Pick<Timeline, 'overlays'>, shot: Shot, frame: number, surface: string, fallback: string): string {
  const hits = tl.overlays
    .filter((o) => o.type === 'screen' && o.id.startsWith(`${shot.scene}/`) && o.start <= frame && (o.props.surface === undefined || o.props.surface === surface))
    .sort((a, b) => a.start - b.start);
  return String(hits[hits.length - 1]?.props.content ?? fallback);
}
