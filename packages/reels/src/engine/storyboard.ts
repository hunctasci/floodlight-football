/**
 * Storyboard from a compiled Timeline (pure, Node-safe): a Markdown shot
 * table — timecode, beat, purpose, world, camera, cast, on-screen text and
 * graphics, sound — so the storyboard always matches what renders.
 */
import type { ContentSpec } from './spec/types';
import type { Timeline } from './timeline/types';

const tc = (frame: number, fps: number): string => {
  const s = frame / fps;
  return `${Math.floor(s)}.${String(Math.round((s % 1) * 100)).padStart(2, '0')}s`;
};

function cameraText(c: Timeline['shots'][number]['camera']): string {
  const subj = c.on ? `:${c.on}${c.at ? `>${c.at}` : ''}` : '';
  const to = c.to ? ` → ${c.to.lens}${c.to.on ? `:${c.to.on}` : ''}` : '';
  return `${c.lens}${subj}${c.move.length ? ` ${c.move.join(' ')}` : ''}${to}`;
}

export function storyboardMarkdown(spec: ContentSpec, tl: Timeline, intro: string): string {
  const rows = tl.shots.map((s) => {
    const inShot = (f: number) => f >= s.start && f < s.start + s.duration;
    const cast = s.actors
      .map((a) => {
        const acts = a.keys.filter((k) => inShot(k.frame) || k === a.keys[a.keys.length - 1]).map((k) => k.action + (k.lookAt ? ` → ${k.lookAt}` : ''));
        return `${tl.cast[a.cast]?.name ?? a.cast} (${a.look}${a.hold ? `, holds ${a.hold}` : ''}): ${[...new Set(acts)].join(', ')}${a.move ? ` · walks to ${a.move.to}` : ''}`;
      })
      .join('<br>');
    const text = tl.overlays
      .filter((o) => (o.shot === s.id || (!o.shot && o.start < s.start + s.duration && o.end > s.start)) && !['chat', 'typing', 'system-note', 'screen'].includes(o.type))
      .map((o) => (o.kind === 'text' ? `“${(o.text ?? '').replace(/\n/g, ' / ')}” (${o.type})` : `[${o.type}${o.text ? ` ${o.text}` : ''}${o.props.headline ? ` ${o.props.headline}` : ''}${o.props.say ? ` “${o.props.say}”` : ''}]`))
      .filter((v, i, a) => a.indexOf(v) === i)
      .join('<br>');
    const chat = tl.overlays.filter((o) => (o.type === 'chat' || o.type === 'typing') && inShot(o.start)).map((o) => (o.type === 'typing' ? `${o.props.from} typing…` : `${o.props.from}: “${o.props.say}”`)).join('<br>');
    const sound = tl.sounds.filter((x) => inShot(x.frame) && x.cue !== 'hush').map((x) => x.cue);
    const hush = tl.sounds.some((x) => inShot(x.frame) && x.cue === 'hush') ? ' · silence' : '';
    const fx = s.fx.map((e) => e.type);
    const enter = s.enter ? `**${s.enter.type}** in` : '';
    return `| ${tc(s.start, tl.fps)}–${tc(s.start + s.duration, tl.fps)} | **${s.beat}**${s.purpose ? `<br>_${s.purpose}_` : ''} | ${s.world}${enter ? `<br>${enter}` : ''} | \`${cameraText(s.camera)}\` | ${cast || '—'}${fx.length ? `<br>fx: ${[...new Set(fx)].join(', ')}` : ''} | ${[text, chat].filter(Boolean).join('<br>') || '—'} | ${[...new Set(sound)].join(', ') || '—'}${hush} |`;
  });
  return [
    `# ${spec.title}`,
    '',
    intro,
    '',
    `**Format:** ${tl.width}×${tl.height} · ${tl.fps} fps · ${(tl.totalFrames / tl.fps).toFixed(2)} s · ${tl.shots.length} shots  `,
    `**Cast:** ${Object.values(tl.cast).map((c) => `${c.name} (${c.country} #${c.number})`).join(', ')}  `,
    `**Source:** \`packages/reels/src/content/autumn-2026/\` — spec id \`${spec.id}\` (this table is generated from the compiled timeline).`,
    '',
    '| Time | Beat | World | Camera | Cast / world events | On screen | Sound |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
