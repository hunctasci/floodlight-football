import type { TrailerId, TrailerShotDef } from './types';

/**
 * world-league-hero segment table (~17.6s): the trailer's director decisions.
 * AI never authors these — timecodes, source ranges and cameras are internal.
 *
 * Conventions:
 * - Global windows tile exactly ([start, end), no gaps/overlaps).
 * - Source ranges reuse existing scenes at ~1x (rate ≈ 1), except deliberate
 *   impact holds (header/save/bar stretched 2–3x) and one anticipation
 *   slowdown (striker closeup 0.71x).
 * - Matchup 0 = countries[0..1] (TR/GR), 1 = countries[2..3] (BR/AR),
 *   2 = countries[4..5] (DE/FR).
 * - Cameras are semantic preset names (never coordinates); 'source' keeps
 *   the scene's own lens.
 */

export const WORLD_LEAGUE_HERO_DURATION = 17.6;
export const WORLD_LEAGUE_HERO_FPS = 60;

function shot(
  id: string, start: number, end: number,
  purpose: TrailerShotDef['purpose'],
  camera: TrailerShotDef['camera'],
  source: TrailerShotDef['source'],
  matchup: TrailerShotDef['matchup'],
  srcStart: number, srcEnd: number,
  label: string, job: string,
  actor?: TrailerShotDef['actor'],
): TrailerShotDef {
  return { id, start, end, purpose, camera, source, matchup, srcStart, srcEnd, label, job, ...(actor ? { actor } : {}) };
}

export function worldLeagueHeroShots(): TrailerShotDef[] {
  return [
    // ACT 1 — FACES / RIVALRY (0–1.5)
    shot('s01-tr-portrait', 0.00, 0.40, 'character', 'player-portrait', 'faceoff', 0, 3.00, 3.40,
      'TR 3/4 closeup push-in', 'Hook: I pick a country — Turkish HNC player, red kit',
      { kind: 'faceoff-home' }),
    shot('s02-gr-portrait', 0.40, 0.72, 'character', 'player-portrait', 'faceoff', 0, 3.10, 3.42,
      'GR portrait opposite direction', 'Rivalry: Greek player in blue answers the stare',
      { kind: 'faceoff-away' }),
    shot('s03-boot-ball', 0.72, 1.05, 'character', 'boot-ball', 'faceoff', 0, 0.10, 0.43,
      'grass-height boot/ball duel', 'Western-duel tension: whistle, stillness before kickoff'),
    shot('s04-crowd-wave', 1.05, 1.50, 'reaction', 'crowd-low', 'faceoff', 0, 0.90, 1.35,
      'tribunes + TR/GR sections + wave', 'Scale: low into the stand, wave + flags alive, hard cut on the kick'),
    // ACT 2 — SPEED / FIRST MATCH (1.5–3.05, attack-goal TR/GR)
    shot('s05-kickoff', 1.50, 1.75, 'impact', 'boot-ball', 'attack-goal', 0, 1.05, 1.30,
      'boot-contact hero insert', 'Kick: no wide setup, contact + kick SFX'),
    shot('s06-duel-chase', 1.75, 2.30, 'speed', 'duel-chase', 'attack-goal', 0, 1.90, 2.45,
      'duel-chase toward goal', 'SPEED: race to the ball — carrier + chaser converge as it travels, goal grows'),
    shot('s07-one-touch', 2.30, 2.60, 'speed', 'ground-ball', 'attack-goal', 0, 3.40, 3.70,
      'side closeup one-touch pass', 'Technique flash: 0.3s, keeps feet moving'),
    shot('s08-ball-chase', 2.60, 3.05, 'speed', 'ball-chase', 'attack-goal', 0, 3.55, 4.00,
      'ball-chase through-ball', 'Racing chase: field rushes beneath, receiver/goal ahead'),
    // ACT 3 — CROSS / HEADER HERO (3.05–5.35, cross-header TR/GR)
    shot('s09-winger', 3.05, 3.45, 'speed', 'winger-close', 'cross-header-goal', 0, 2.55, 2.95,
      'touchline tracking winger', 'Drive to the cross: fast, low, touchline'),
    shot('s10-cross-flight', 3.45, 3.85, 'speed', 'source', 'cross-header-goal', 0, 3.50, 3.90,
      'cross contact + ball-follow flight', 'Hard edit on contact: staged follow keeps the flight seed-tuned'),
    shot('s11-mouth', 3.85, 4.30, 'geography', 'source', 'cross-header-goal', 0, 5.00, 5.45,
      'goal-mouth geography', 'Setup reads: staged wide holds striker, defender, keeper, rising crowd'),
    shot('s12-striker', 4.30, 4.65, 'character', 'striker-low', 'cross-header-goal', 0, 5.30, 5.55,
      'striker 3/4 low slowdown', 'Anticipation: slight slowdown, crowd rises, defender contests (clear side)'),
    shot('s13-header', 4.65, 4.80, 'impact', 'header-impact', 'cross-header-goal', 0, 5.80, 5.85,
      'HEADER hero hold', 'Best image: ball at head, face readable, keeper deep, FOV punch + THUMP'),
    shot('s14-dive', 4.80, 5.10, 'character', 'ball-follow', 'cross-header-goal', 0, 5.85, 6.15,
      'keeper dive + ball across', 'Desperation: wide flight follow holds ball, diving keeper and goal together'),
    shot('s15-net', 5.10, 5.35, 'reveal', 'source', 'cross-header-goal', 0, 6.20, 6.45,
      'behind-net goal, net bulge', 'Goal: staged behind-net cine holds ball into net + roar'),
    // ACT 4 — REACTION (5.35–6.2)
    shot('s16-scorer', 5.35, 5.65, 'reaction', 'reaction-scorer', 'cross-header-goal', 0, 6.80, 7.10,
      'scorer celebration closeup', 'Joy: arms, brief, cut before it lingers',
      { kind: 'scene-index', index: 2 }),
    shot('s17-keeper-down', 5.65, 5.90, 'reaction', 'reaction-keeper', 'cross-header-goal', 0, 7.10, 7.35,
      'keeper disappointment portrait', 'Cost: beaten keeper, purple kit, goal frame',
      { kind: 'keeper' }),
    shot('s18-fans', 5.90, 6.20, 'reaction', 'reaction-crowd', 'cross-header-goal', 0, 6.60, 6.90,
      'TR erupts / GR collapses', 'Stakes: supporter sections split, no branding yet'),
    // ACT 5 — WORLD LEAGUE MONTAGE: CROSSBAR (6.2–9.0, BR/AR)
    shot('s19-card-brar', 6.20, 6.55, 'message', 'attack-wide', 'crossbar-chaos', 1, 0.20, 0.55,
      'BRASIL VS ARGENTINA card', 'Graphic cut: new rivalry, no long intro'),
    shot('s20-shooter', 6.55, 7.05, 'character', 'striker-low', 'crossbar-chaos', 1, 2.60, 3.05,
      'Brazil shooter low, mid-attack', 'No setup: already dangerous'),
    shot('s21-flight', 7.05, 7.35, 'speed', 'ball-follow', 'crossbar-chaos', 1, 3.45, 3.75,
      'shot travelling', 'Velocity: ball-follow, anticipation'),
    shot('s22-clang', 7.35, 7.55, 'impact', 'crossbar-angle', 'crossbar-chaos', 1, 4.30, 4.36,
      'CROSSBAR clang hold', 'CLANG: hero angle, impact hold, metallic shake'),
    shot('s23-keeper-up', 7.55, 7.80, 'reaction', 'keeper-eyes', 'crossbar-chaos', 1, 4.36, 4.61,
      'keeper looks up lost', 'Comedy: stranded look-up',
      { kind: 'keeper' }),
    shot('s24-defender', 7.80, 8.00, 'reaction', 'reaction-defender', 'crossbar-chaos', 1, 4.61, 4.81,
      'defender hands on head', 'Quick comedy punctuation',
      { kind: 'scene-index', index: 3 }),
    shot('s25-topdown', 8.00, 8.25, 'reveal', 'top-down-box', 'crossbar-chaos', 1, 5.10, 5.35,
      'top-down ball descending', 'Geography: the chaos hangs, crowd gasps'),
    shot('s26-volley', 8.25, 8.50, 'impact', 'shot-impact', 'crossbar-chaos', 1, 6.70, 6.95,
      'rebound volley', 'Second strike: volley THUMP'),
    shot('s27-net2', 8.50, 8.75, 'reveal', 'behind-goal-net', 'crossbar-chaos', 1, 7.45, 7.70,
      'behind net GOAL', 'Payoff: double eruption begins'),
    shot('s28-erupt', 8.75, 9.00, 'reaction', 'reaction-crowd', 'crossbar-chaos', 1, 8.30, 8.55,
      'crowd eruption cut', 'Release: cut before it settles'),
    // MATCH 3 — KEEPER DISASTER (9.0–11.65, DE/FR)
    shot('s29-card-defr', 9.00, 9.28, 'message', 'attack-wide', 'keeper-disaster', 2, 0.10, 0.38,
      'DEUTSCHLAND VS FRANCE card', 'Fast country card, third rivalry'),
    shot('s30-windup', 9.28, 9.60, 'character', 'striker-low', 'keeper-disaster', 2, 2.20, 2.50,
      'attacker winding up, cut on the strike', 'No setup: already loading the shot; excerpt ends exactly at contact so the strike SFX lives in the next shot only',
      { kind: 'scene-index', index: 2 }),
    shot('s31-flight-keeper', 9.60, 9.95, 'speed', 'ball-follow', 'keeper-disaster', 2, 2.50, 2.85,
      'ball-flight / keeper POV', 'Threat: ball travels, keeper loads'),
    shot('s32-glove', 9.95, 10.10, 'impact', 'keeper-glove', 'keeper-disaster', 2, 3.30, 3.35,
      'GLOVE SAVE hero', 'WHAT A SAVE: heavy thud + whoosh, micro-silence before'),
    shot('s33-hero-keeper', 10.10, 10.38, 'character', 'keeper-close', 'keeper-disaster', 2, 3.85, 4.13,
      'keeper hero portrait', 'Beat: viewer thinks WHAT A SAVE (brief glory)',
      { kind: 'keeper' }),
    shot('s34-clearance', 10.38, 10.63, 'speed', 'ground-ball', 'keeper-disaster', 2, 5.70, 5.95,
      'bad clearance ground-ball', 'Dry punt: deliberately no juice'),
    shot('s35-reveal', 10.63, 10.83, 'reveal', 'attack-wide', 'keeper-disaster', 2, 6.30, 6.50,
      'WIDE REVEAL attacker free', 'The joke: inexplicably free poacher'),
    shot('s36-first-time', 10.83, 11.08, 'impact', 'shot-impact', 'keeper-disaster', 2, 7.70, 7.95,
      'instant first-time shot', 'No mercy: instant hit'),
    shot('s37-goal3', 11.08, 11.30, 'reveal', 'source', 'keeper-disaster', 2, 8.30, 8.52,
      'goal / net', 'Huge sound: staged follow tracks the ball across the line'),
    shot('s38-despair', 11.30, 11.65, 'reaction', 'reaction-keeper', 'keeper-disaster', 2, 9.00, 9.35,
      'keeper kneeling despair', 'Funniest cut: front/3-4 slump, crowd behind',
      { kind: 'keeper' }),
    // ACT 6 — ADRENALINE MONTAGE (11.65–13.2, ~8 micros synced to percussion)
    shot('m01-eye', 11.65, 11.80, 'character', 'player-portrait', 'faceoff', 0, 3.20, 3.35,
      'micro: player eye/face', 'Percussion 1: face',
      { kind: 'faceoff-home' }),
    shot('m02-boot', 11.80, 11.95, 'impact', 'boot-ball', 'cross-header-goal', 0, 0.95, 1.10,
      'micro: boot hits ball', 'Percussion 2: contact'),
    shot('m03-flag', 11.95, 12.08, 'reaction', 'reaction-crowd', 'crossbar-chaos', 1, 8.30, 8.43,
      'micro: supporter flag', 'Percussion 3: fans'),
    shot('m04-dive', 12.08, 12.22, 'character', 'keeper-eyes', 'keeper-disaster', 2, 2.70, 2.84,
      'micro: keeper dive load', 'Percussion 4: tension',
      { kind: 'keeper' }),
    shot('m05-lens', 12.22, 12.36, 'speed', 'source', 'cross-header-goal', 0, 4.20, 4.34,
      'micro: staged ball-near-lens', 'Percussion 5: signature lens whoosh (seed-parked)'),
    shot('m06-bar', 12.36, 12.50, 'impact', 'crossbar-angle', 'crossbar-chaos', 1, 4.28, 4.42,
      'micro: crossbar hit', 'Percussion 6: CLANG flash'),
    shot('m07-header', 12.50, 12.65, 'impact', 'header-impact', 'cross-header-goal', 0, 5.78, 5.93,
      'micro: power header', 'Percussion 7: THUMP flash'),
    shot('m08-hands', 12.65, 12.80, 'reaction', 'crowd-low', 'keeper-disaster', 2, 8.40, 8.55,
      'micro: crowd hands jumping', 'Percussion 8: eruption'),
    shot('m09-spin', 12.80, 12.98, 'reaction', 'reaction-scorer', 'crossbar-chaos', 1, 8.75, 8.93,
      'micro: Brazil celebration', 'Percussion 9: joy in another country kit',
      { kind: 'scene-index', index: 1 }),
    shot('m10-post', 12.98, 13.20, 'impact', 'goalpost-side', 'crossbar-chaos', 1, 7.40, 7.62,
      'micro: goalpost view + kits', 'Percussion 10: release into message'),
    // ACT 7 — EXPLAIN HNC (13.2–15.2, gameplay visible, no slideshow)
    shot('s39-pick', 13.20, 13.85, 'message', 'player-portrait', 'faceoff', 0, 2.80, 3.45,
      'PICK A COUNTRY over closeup', 'Concept 1: country closeup/kickoff behind text',
      { kind: 'faceoff-away' }),
    shot('s40-win', 13.85, 14.50, 'message', 'duel-chase', 'attack-goal', 0, 2.40, 3.05,
      'WIN 1V1 MATCHES over duel', 'Concept 2: duel/chase/pass behind text'),
    shot('s41-climb', 14.50, 15.20, 'message', 'reaction-crowd', 'crossbar-chaos', 1, 8.20, 8.90,
      'CLIMB THE WORLD LEAGUE over fans', 'Concept 3: crowd + multi-country action, flashes TR GR BR AR DE FR'),
    // ACT 8 — FINAL BUILD (15.2–16.15)
    shot('s42-hero', 15.20, 15.65, 'impact', 'source', 'cross-header-goal', 0, 5.75, 6.20,
      'final header flash', 'Build: staged impact + flight + punch carry the music rise'),
    shot('s43-erupt2', 15.65, 16.15, 'reaction', 'behind-supporters', 'crossbar-chaos', 1, 8.30, 8.80,
      'large crowd eruption', 'Peak: supporters + celebration behind'),
    // ACT 9 — BRAND PAYOFF (16.15–17.6)
    shot('s44-brand', 16.15, 17.60, 'brand', 'source', 'attack-goal', 0, 7.30, 8.60,
      'HNC badge + PLAY FOR YOUR COUNTRY', 'Payoff: staged celebration wide keeps scorer + stadium behind the dominant badge, sting, hncleague.com'),
  ];
}

export function trailerDuration(_trailer: TrailerId): number {
  return WORLD_LEAGUE_HERO_DURATION;
}
