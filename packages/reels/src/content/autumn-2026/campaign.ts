/**
 * Autumn 2026 campaign metadata — THE WORLD KEEPS PLAYING. One vertical master
 * reel (1080×1920, 60 fps) + one 4:5 key-art post per item; platform copy
 * lives beside the renders (social/output/autumn-2026/<dir>/copy.md).
 * Fixture dates verified against the published 2026/27 Nations League
 * league-phase schedule (League A, Group 1); no results or stakes claimed.
 */
import type { ContentSpec } from '../../engine/spec/types';
import { RIVALRY_DIDNT } from './01-rivalry-didnt';
import { COFFEE_MACHINE } from './02-coffee-machine';
import { ESPRESSO } from './03-espresso';
import { EUROPEAN_NIGHT } from './04-european-night';
import { SAY_IT } from './05-say-it-on-the-pitch';
import { REPUBLIC_DAY } from './06-29-ekim';
import { KEEPER } from './07-keeper';
import { BREAKING } from './08-breaking';
import { REMATCH } from './09-rematch';
import { ONE_MORE } from './10-one-more';

export interface CampaignItem {
  n: number;
  dir: string;
  title: string;
  reel: ContentSpec;
  poster: string;
  /** Target date(s) (2026). */
  date: string;
  context: string;
  window: string;
  /** Creative summary (storyboard + report). */
  notes: { hook: string; story: string; surprise: string; payoff: string };
}

export const CAMPAIGN_ROOT = 'social/output/autumn-2026';

export const CAMPAIGN: CampaignItem[] = [
  { n: 1, dir: '01-rivalry-didnt', title: 'The Tournament Ended. The Rivalry Didn’t.', reel: RIVALRY_DIDNT, poster: 'autumn-01-poster', date: '30 Sep – 1 Oct', context: 'Campaign launch after the summer’s international tournament (no marks, no claims).', window: '30 Sep, 20:00–22:00 TRT (evening scroll); X repost next morning' , notes: { hook: 'The end-of-coverage TV clicks to black: THE TOURNAMENT ENDED.', story: 'Emre packs away the summer — remote down, scarf folded into a moving box. Silence. A ball rolls out of the dark hallway and stops at his feet; his phone lights up; cold light pours through the window and a crowd rises far away.', surprise: 'A football arriving from nowhere in a quiet flat, filmed from the floor as it rolls at the lens.', payoff: 'The window light becomes a floodlight: the stadium at night, Emre facing Nikos — THE RIVALRY DIDN\'T.' } },
  { n: 2, dir: '02-coffee-machine', title: 'The Coffee Machine Incident', reel: COFFEE_MACHINE, poster: 'autumn-02-poster', date: '2 Oct', context: 'Belgium vs Türkiye (Nations League A, Group 1) — matchday.', window: '2 Oct, 08:30–10:00 TRT (office arrival, matchday morning)' , notes: { hook: 'A perfectly symmetrical office kitchen; two coworkers walk in from opposite sides toward the only cup.', story: 'Both hands land on it. Stares, flag badges, coworkers quietly leave, the machine hisses like a film score, Emre slides the cup toward himself, Lucas sees.', surprise: 'The lights stutter — and in the dark frames they are already in their national kits. The cup falls; MATCH CUT on the impact: the ball lands on the pitch.', payoff: 'Emre scores. Back in the kitchen he calmly takes the coffee; Lucas nods. THIS WAS NEVER ABOUT COFFEE.' } },
  { n: 3, dir: '03-espresso', title: 'Espresso → Screamer', reel: ESPRESSO, poster: 'autumn-03-poster', date: '5 Oct', context: 'Italy vs Türkiye (Nations League A, Group 1) — matchday.', window: '5 Oct, 16:00–18:00 TRT (pre-match build-up)' , notes: { hook: 'A top-down macro of crema on black marble.', story: 'Emre turns the espresso on its saucer — slowly, then faster, faster.', surprise: 'MATCH CUT at full spin: a football spinning on floodlit grass in slow motion; the camera rises and a free kick assembles itself around it. ONE SHOT.', payoff: 'Curled over the wall into the top corner — cut on the net: the crema ripples in the café. He drinks. MAKE IT COUNT.' } },
  { n: 4, dir: '04-european-night', title: 'European Night Leaks Into the Office', reel: EUROPEAN_NIGHT, poster: 'autumn-04-poster', date: '13–14 Oct', context: 'A big European club-football week with Turkish clubs involved (no competition marks, no clubs).', window: '13 Oct, 18:30–20:00 TRT (before the evening kick-offs)' , notes: { hook: 'A late office lit only by monitors on a big European night.', story: 'Every desk hides something: a stream in a spreadsheet, one earbud, refresh-refresh-refresh, commentary leaking. The boss walks the aisle; everyone becomes violently productive; a collective exhale.', surprise: 'Every screen goes black. Silence. One wakes up: YOUR MATCH IS READY.', payoff: 'One continuous crane: the carpet becomes a pitch, the panels floodlights, coworkers fans. EVERYONE HAS A MATCH TONIGHT. SO DO YOU.' } },
  { n: 5, dir: '05-say-it', title: 'Say It On The Pitch', reel: SAY_IT, poster: 'autumn-05-poster', date: '20–21 Oct', context: 'Another European football week; group-chat rivalry culture.', window: '20 Oct, 21:00–23:30 TRT (group chats are loud)' , notes: { hook: 'A group chat in full rivalry mode: easy win / 😂.', story: 'you sure? / 🇬🇷🇬🇷🇬🇷 / typing… typing… / 1v1 then. Silence; the phone buzzes.', surprise: 'The bubble grows until it is the frame: a phone the size of a building on a stage, and the two of them step out of its glass.', payoff: 'A fast match and a goal — then back in the thread: best of 3?' } },
  { n: 6, dir: '06-29-ekim', title: '29 Ekim', reel: REPUBLIC_DAY, poster: 'autumn-06-poster', date: '29 Oct', context: 'Republic Day in Türkiye (29 Ekim Cumhuriyet Bayramı). Respectful; no product message.', window: '29 Oct, 08:00–10:00 TRT (the morning of the day)' , notes: { hook: 'First light over an original city; a player with 29 on his back at a rooftop parapet.', story: 'A large flag lifts in the wind as the sky turns red; a quiet profile.', surprise: 'A slow dissolve into an empty stadium at dawn, the crescent and star laid across the terraces; five Turkish players walk out together.', payoff: '29 EKİM · CUMHURİYET BAYRAMIMIZ KUTLU OLSUN — nothing else.' } },
  { n: 7, dir: '07-keeper', title: 'The Keeper Who Doesn’t Blink', reel: KEEPER, poster: 'autumn-07-poster', date: '31 Oct', context: 'Halloween.', window: '31 Oct, 19:00–23:00 TRT' , notes: { hook: 'From behind the goal: a keeper\'s motionless back, a striker small in the fog.', story: 'Nikos walks on; the keeper never moves — only his head follows. Nikos blinks; the keeper doesn\'t. The ball rolls out to the spot on its own.', surprise: 'The penalty — and the lights die before we see it. Black. A huge save.', payoff: 'The lights stutter back: the keeper is standing right beside him, ball in his hands. SOME KEEPERS NEVER SLEEP.' } },
  { n: 8, dir: '08-breaking', title: 'Breaking: The World Table Is Moving', reel: BREAKING, poster: 'autumn-08-poster', date: '3–4 Nov', context: 'A high-attention European football week; World Table culture (standings illustrative).', window: '3 Nov, 12:00–14:00 TRT (lunch-break news scroll)' , notes: { hook: 'BREAKING slams in: the World Table is moving.', story: 'Kaan reads it like the world has changed; glitch to the table (Japan up to 3rd); push in; the banner escalates; glitch — Türkiye takes 1st.', surprise: 'Meltdown: a red frame, a BREAKING strip, and the studio floor lights up as a giant World Table laid across a pitch.', payoff: 'THE TABLE NEVER SLEEPS. (All standings illustrative.)' } },
  { n: 9, dir: '09-rematch', title: 'The Rematch', reel: REMATCH, poster: 'autumn-09-poster', date: '12 Nov', context: 'Türkiye vs Belgium (Nations League A, Group 1) — callback to #02.', window: '12 Nov, 08:30–10:00 TRT (matchday morning, same slot as #02)' , notes: { hook: 'The exact symmetrical frame of #02 — but the counter is bare.', story: 'The office has prepared: NO FOOTBALL IN THE KITCHEN, blinds shut, a coworker slips out. Emre and Lucas walk in knowing; the machine blinks REMATCH; knuckles; tie.', surprise: 'One surge and we are in (faster than #02): Lucas strikes, Belgium in red, Türkiye in clash-white — the crossbar rings and the ball rises into the night.', payoff: 'It lands in the coffee machine. Nobody wins. ROUND 3?' } },
  { n: 10, dir: '10-one-more', title: 'One More', reel: ONE_MORE, poster: 'autumn-10-poster', date: '15 Nov', context: 'France vs Türkiye — Türkiye’s final scheduled league-phase fixture (verify any stakes before posting).', window: '15 Nov, 17:00–19:30 TRT (pre-match)' , notes: { hook: 'An empty office corridor at night; one notification: ONE MORE.', story: 'Emre looks up and walks. Each cut hides behind a pillar and he is more footballer each time — blazer, shirt, the country shirt with #9 appearing on his back, full kit — as carpet becomes concrete becomes tunnel and footsteps become a crowd\'s rhythm.', surprise: 'He stops at the mouth. One breath. The world goes quiet.', payoff: 'He walks into the light. White. ONE MORE.' } },
];

export function campaignDir(item: CampaignItem): string {
  return `${CAMPAIGN_ROOT}/${item.dir}`;
}
