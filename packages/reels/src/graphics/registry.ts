/**
 * Graphics + typography vocabulary (pure metadata for validation and docs).
 * Components live in graphics/*.tsx and are mapped in render/Overlays.tsx.
 */
export interface GraphicDef {
  summary: string;
  /** Documented props (keys ending in `At` are times). */
  props: Record<string, string>;
  /** Worlds whose scene renders it (in-world graphics). */
  worlds?: string[];
}

export const GRAPHICS: Record<string, GraphicDef> = {
  eyebrow: { summary: 'Game HUD eyebrow label that slides in (e.g. HNC LEAGUE)', props: { exitAt: 'time it leaves' } },
  scoreboard: {
    summary: 'The game scoreboard (TR 0-0 GR, clock) that flips on the goal',
    props: { before: '[home, away] goals', after: '[home, away] after the flip', clock: "match clock text e.g. \"2ND 89'\"", enterAt: 'slide-in time', flipAt: 'score flip time', home: 'cast id (default: first two cast)', away: 'cast id' },
  },
  'goal-call': { summary: 'Big GOAL! call with a sub line', props: { sub: 'sub line', exitAt: 'time it leaves' } },
  'world-table': {
    summary: 'The game WORLD TABLE; the hero nation climbs after a win',
    props: { rows: '[{code, points}] (default: illustrative table)', hero: 'cast id whose country climbs', gain: 'points gained (default 3)', climbAt: 'climb time', exitAt: 'time it leaves', lines: '[line1, line2] headline', tag: 'row tag (default YOU)', note: 'footnote, e.g. ILLUSTRATIVE STANDINGS' },
  },
  'brand-reveal': { summary: 'HNC badge + three-word promise + site button end card', props: { words: 'array of words', site: 'url', footer: 'small footer line' } },
  'breaking-banner': { summary: 'Red BREAKING NEWS banner that slams in', props: { label: 'banner label (default BREAKING)', headline: 'headline text', level: '1 calm · 2 urgent (shakes, pulses) · 3 meltdown (red frame + BREAKING strip)' } },
  'lower-third': { summary: 'News lower third: name + role, country flag', props: { cast: 'cast id', role: 'role line' } },
  ticker: { summary: 'Scrolling news ticker along the bottom', props: { items: 'array of strings' } },
  'live-bug': { summary: 'LIVE bug + channel mark in the corner', props: { channel: 'channel name (default HNC SPORTS)' } },
  chat: { summary: 'Chat message in the phone thread (stacks up)', props: { from: 'cast id', say: 'message text', reply: 'quoted text', image: 'goal | table (attachment card)' }, worlds: ['phone'] },
  typing: { summary: 'Typing indicator in the phone thread', props: { from: 'cast id' }, worlds: ['phone'] },
  'system-note': { summary: 'Grey system line in the thread ("Nikos left the group")', props: { say: 'text' }, worlds: ['phone'] },
  notification: { summary: 'Push notification banner drops from the top', props: { app: 'app name', title: 'title', body: 'body' } },
  versus: { summary: 'Two-flag VS card', props: { home: 'cast id', away: 'cast id' } },
  timestamp: { summary: 'Typographic time stamp ("MONDAY · 09:03")', props: { day: 'day text', time: 'time text' } },
  stamp: { summary: 'Rubber-stamp slam text ("WORTH IT")', props: { tilt: 'degrees', color: 'gold | red | cream' } },
  screen: { summary: 'Switch an in-world screen’s content from this beat', props: { surface: 'surface id', content: 'screen content id' } },
  lockup: { summary: 'Small HNC League lockup (badge + wordmark) that settles in; optional line under it', props: { line: 'small line under the wordmark', place: 'bottom | center | top', tone: 'light | dark', plate: 'true: dark backing pill for busy backgrounds' } },
};

export const GRAPHIC_KINDS = Object.keys(GRAPHICS);

export const TEXT_STYLES: Record<string, string> = {
  hook: 'Big Impact headline, words punch in, hard navy shadow',
  pov: 'POV meme caption: white on black strip, lowercase allowed',
  caption: 'Meme caption with heavy outline (bottom third)',
  kicker: 'Small gold mono label above a headline',
  impact: 'Huge one-word punch (zoom-in, shake)',
  label: 'Small tag pinned to a subject with a leader line',
  subtitle: 'Plain subtitle (dialogue)',
  whisper: 'Small italic aside (* slow side-eye *)',
  stamp: 'Rotated stamp slam',
  title: 'Campaign headline (Futura Condensed), lines rise in; use \\n for lines, last line gold',
  cinema: 'Quiet serif caps (Didot), wide tracking, slow fade — film titles',
  'cinema-ink': 'Cinema serif in navy ink, larger — for white / light plates',
  monument: 'Ceremony: very large quiet serif (dates, names)',
  dedication: 'Ceremony: small tracked serif caps line (a dedication under a monument)',
  broadcast: 'Condensed broadcast caps (DIN), snaps open vertically',
  horror: 'Bodoni italic caps with a red ghost glow and a nervous jitter',
  typewriter: 'Typed-out memo line on paper',
};

export const TEXT_STYLE_IDS = Object.keys(TEXT_STYLES);
