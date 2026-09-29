import React from 'react';
import { projectToScreen } from '../camera/project';
import type { OverlayEvent, Timeline } from '../engine/timeline/types';
import type { SubjectResolver } from '../engine/subjects';
import { BrandReveal } from '../graphics/BrandReveal';
import { Eyebrow } from '../graphics/Eyebrow';
import { GoalCall } from '../graphics/GoalCall';
import { BreakingBanner, LiveBug, LowerThird, Ticker, Timestamp, Versus } from '../graphics/News';
import { Notification } from '../graphics/Notification';
import { Scoreboard } from '../graphics/Scoreboard';
import { Text } from '../graphics/Text';
import { WorldTable, type WorldTableRow } from '../graphics/WorldTable';
import type { Lens } from '../worlds/types';
import { FitBox } from './FitBox';
import { useLayout } from './layout';

/** Kinds a world renders itself (phone thread, in-world screens). */
const WORLD_OWNED = new Set(['chat', 'typing', 'system-note', 'screen']);

/** Illustrative World Table: rival just ahead of the hero (promo values). */
export function defaultTableRows(hero: string, rival: string): WorldTableRow[] {
  const others = ['BR', 'DE', 'JP', 'AR', 'FR'].filter((c) => c !== hero && c !== rival).slice(0, 3);
  return [
    { code: rival, points: 41 },
    { code: hero, points: 39 },
    { code: others[0], points: 37 },
    { code: others[1], points: 36 },
    { code: others[2], points: 34 },
  ];
}

export const Overlay: React.FC<{
  ev: OverlayEvent;
  tl: Timeline;
  frame: number;
  lens?: Lens;
  subject?: SubjectResolver;
}> = ({ ev, tl, frame, lens, subject }) => {
  const { width, height } = useLayout();
  if (frame < ev.start || frame >= ev.end || WORLD_OWNED.has(ev.type)) return null;
  const fps = tl.fps;
  const p = ev.props;
  const castIds = Object.keys(tl.cast);
  const country = (id: unknown, fallback: number) => tl.cast[String(id ?? castIds[fallback])]?.country ?? String(id ?? 'TR');
  const at = typeof p.at === 'number' ? p.at : ev.start;

  if (ev.kind === 'text') {
    let pin: { x: number; y: number } | undefined;
    if (ev.place?.startsWith('on:') && lens && subject) {
      const s = subject(ev.place.slice(3));
      if (s) {
        const q = projectToScreen(lens, { x: s.head.x, y: s.head.y + 0.45, z: s.head.z }, width, height);
        if (q.visible) pin = { x: Math.min(width - 160, Math.max(160, q.x)), y: Math.max(140, q.y) };
      }
    }
    return <Text text={ev.text ?? ''} style={ev.type} frame={frame} fps={fps} start={ev.start} end={ev.end} pin={pin} place={pin ? undefined : ev.place} words={ev.words} />;
  }

  switch (ev.type) {
    case 'eyebrow':
      return <Eyebrow frame={frame} text={ev.text ?? 'HNC LEAGUE'} at={at} exitAt={Number(p.exitAt ?? ev.end)} />;
    case 'scoreboard':
      return (
        <Scoreboard
          frame={frame}
          fps={fps}
          home={country(p.home, 0)}
          away={country(p.away, 1)}
          before={(p.before as [number, number]) ?? [0, 0]}
          after={p.after as [number, number] | undefined}
          clock={String(p.clock ?? '')}
          enterAt={p.enterAt as number | undefined}
          flipAt={p.flipAt as number | undefined}
        />
      );
    case 'goal-call':
      return <GoalCall frame={frame} fps={fps} text={ev.text ?? 'GOAL!'} sub={p.sub as string | undefined} at={at} exitAt={Number(p.exitAt ?? ev.end - 12)} />;
    case 'world-table': {
      const hero = country(p.hero, 0);
      const rows = (p.rows as WorldTableRow[] | undefined) ?? defaultTableRows(hero, country(p.rival, 1));
      return (
        <FitBox top={300} bottom={1580}>
          <WorldTable frame={frame} fps={fps} rows={rows} hero={hero} gain={Number(p.gain ?? 3)} enterAt={Number(p.enterAt ?? at)} climbAt={Number(p.climbAt ?? at + fps)} exitAt={p.exitAt as number | undefined} lines={(p.lines as [string, string]) ?? ['YOUR COUNTRY.', 'YOUR LEAGUE.']} />
        </FitBox>
      );
    }
    case 'brand-reveal':
      return (
        <FitBox top={270} bottom={1430}>
          <BrandReveal frame={frame} fps={fps} at={at} words={(p.words as string[]) ?? ['PLAY.', 'WIN.', 'CLIMB.']} site={String(p.site ?? 'hncleague.com')} footer={p.footer as string | undefined} />
        </FitBox>
      );
    case 'breaking-banner':
      return <BreakingBanner frame={frame} fps={fps} at={at} end={ev.end} label={String(p.label ?? 'BREAKING')} headline={ev.text ?? String(p.headline ?? '')} />;
    case 'lower-third': {
      const m = tl.cast[String(p.cast)];
      return <LowerThird frame={frame} fps={fps} at={at} end={ev.end} name={m?.name ?? String(p.cast)} country={m?.country ?? 'TR'} role={String(p.role ?? '')} />;
    }
    case 'ticker':
      return <Ticker frame={frame} fps={fps} at={at} end={ev.end} items={(p.items as string[]) ?? []} />;
    case 'live-bug':
      return <LiveBug frame={frame} fps={fps} at={at} end={ev.end} channel={String(p.channel ?? 'HNC SPORTS')} />;
    case 'notification':
      return <Notification frame={frame} fps={fps} at={at} end={ev.end} app={String(p.app ?? 'HNC League')} title={String(p.title ?? '')} body={String(p.body ?? '')} />;
    case 'versus':
      return <Versus frame={frame} fps={fps} at={at} end={ev.end} home={country(p.home, 0)} away={country(p.away, 1)} />;
    case 'timestamp':
      return <Timestamp frame={frame} fps={fps} at={at} end={ev.end} day={String(p.day ?? 'MONDAY')} time={String(p.time ?? '09:03')} />;
    case 'stamp':
      return <Text text={ev.text ?? ''} style="stamp" frame={frame} fps={fps} start={ev.start} end={ev.end} place="center" />;
    default:
      return null;
  }
};
