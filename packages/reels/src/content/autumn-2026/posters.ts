/**
 * Autumn 2026 key-art posters (1080×1350, 4:5). Each is composed as a poster,
 * not grabbed from its reel: a key-art spec (same world, same people, poster
 * staging and lens) → plate(s) → grade → campaign typography. Range on
 * purpose: cinematic key art, symmetric comedy, split minimal, empty-room
 * mystery, graphic pop, ceremony, horror one-sheet, broadcast, fight poster,
 * silhouette.
 */
import type { BeatSpec, CastSpec, ContentSpec, SceneSpec } from '../../engine/spec/types';
import type { PosterDef } from '../../posters/types';
import { CAMPAIGN, campaignDir } from './campaign';

/** One-beat key-art spec: a still is taken at 'still@50%'. */
function keyArt(id: string, cast: Record<string, CastSpec>, scene: Omit<SceneSpec, 'id' | 'beats'> & { beat: Omit<BeatSpec, 'id'> }): ContentSpec {
  const { beat, ...rest } = scene;
  return { id: `keyart-${id}`, title: `Key art ${id}`, fps: 30, seed: 7, cast, scenes: [{ id: 'key', ...rest, beats: [{ ...beat, id: 'still' }] }] };
}
const AT = 'still@50%';

const emre = { person: 'emre' };
const lucas = { person: 'lucas' };
const nikos = { person: 'nikos' };

export const POSTERS: Record<string, PosterDef> = {
  'autumn-01-poster': {
    id: 'autumn-01-poster',
    plates: [
      {
        spec: keyArt('01', { emre: { ...emre, look: 'tee' } }, {
          world: 'apartment',
          set: { tv: 'black', ballGlow: true },
          beat: {
            duration: 1,
            camera: 'poster-floor',
            cast: { emre: { at: 'far', do: { do: 'notice', lookAt: 'ball' } } },
            fx: [{ type: 'ball-roll', at: 0, until: '1f' }, { type: 'room-shift', at: 0, until: 1.6 }, { type: 'remote-down', at: 0 }, { type: 'scarf-in', at: 0 }],
          },
        }),
        at: AT,
        crop: { y: 190 },
      },
    ],
    grade: { vignette: 0.55, gradientBottom: 0.85, gradientTop: 0.5 },
    blocks: [
      { kind: 'text', style: 'cinema', text: 'the tournament ended.', y: 96, size: 40 },
      { kind: 'text', style: 'headline', text: 'the rivalry\ndidn’t.', y: 1000, size: 132 },
      { kind: 'lockup', y: 1268, scale: 0.62 },
    ],
    alt: 'A dark living room at night. In the foreground an HNC football rests on the floorboards, faintly glowing; behind it Emre, an HNC character in a red tee, stands and looks down at it, backlit by a lamp while cold light spills from a window. Headline: THE RIVALRY DIDN’T.',
  },
  'autumn-02-poster': {
    id: 'autumn-02-poster',
    plates: [
      {
        spec: keyArt('02', { emre, lucas }, {
          world: 'breakroom',
          set: { display: 'machine-ready', sign: ['PLEASE WASH', 'YOUR MUG ♥'] },
          beat: {
            duration: 1,
            camera: 'symmetry',
            cast: { emre: { at: 'cup-left', do: { do: 'stare-down', lookAt: 'lucas' } }, lucas: { at: 'cup-right', do: { do: 'stare-down', lookAt: 'emre' } } },
          },
        }),
        at: AT,
        crop: { y: 340 },
      },
    ],
    grade: { vignette: 0.35, gradientTop: 0.55 },
    blocks: [
      { kind: 'text', style: 'kicker', text: 'Belgium vs Türkiye · 02.10', y: 74 },
      { kind: 'text', style: 'headline', text: 'this was never\nabout coffee.', y: 124, size: 112 },
      { kind: 'lockup', y: 1262, scale: 0.62, plate: true },
    ],
    alt: 'A symmetrical office kitchen. Two HNC office workers, Emre with a Turkish flag badge and red tie and Lucas with a Belgian flag badge and yellow tie, stand side-on either side of a coffee machine, both reaching for the single paper cup between them and staring at each other. Headline: THIS WAS NEVER ABOUT COFFEE.',
  },
  'autumn-03-poster': {
    id: 'autumn-03-poster',
    background: '#05070c',
    plates: [
      {
        spec: keyArt('03a', { emre: { ...emre, look: 'office-formal' } }, { world: 'cafe', set: { tod: 'dusk' }, beat: { duration: 1, camera: 'cup-top-wide', cast: { emre: { at: 'seat', do: 'idle' } }, fx: [{ type: 'cup-turn', at: 0, until: 2 }] } }),
        at: AT,
        crop: { y: 620, h: 672 },
        rect: { x: 0, y: 0, w: 1080, h: 672 },
      },
      {
        spec: keyArt('03b', { emre }, { world: 'football', set: { moment: 'free-kick', roles: { striker: 'emre' }, light: 'night', away: 'IT' }, beat: { duration: 1, clock: { from: 0.2, to: 0.3 }, camera: 'ball-overhead-wide' } }),
        at: AT,
        crop: { y: 624, h: 672 },
        rect: { x: 0, y: 678, w: 1080, h: 672 },
      },
    ],
    grade: { vignette: 0.45 },
    blocks: [
      { kind: 'rule', x: 0, y: 672, w: 1080, h: 6, color: '#f7bf30' },
      { kind: 'text', style: 'kicker', text: 'Italy vs Türkiye · 05.10', y: 70 },
      { kind: 'text', style: 'headline', text: 'one shot.', y: 610, size: 118 },
      { kind: 'lockup', y: 1262, scale: 0.6, plate: true },
    ],
    alt: 'A split poster. Top: an espresso cup seen straight from above on a black marble table, crema swirling. Bottom: an HNC football seen straight from above on floodlit grass, the same circle in the same place. A gold line divides them; headline ONE SHOT.',
  },
  'autumn-04-poster': {
    id: 'autumn-04-poster',
    plates: [
      {
        spec: keyArt('04', {}, { world: 'office', set: { time: 'night', clock: '21:47', extras: 0, doorLight: true, ball: 'in-light', screens: { all: 'black' } }, beat: { duration: 1, camera: 'door-floor' } }),
        at: AT,
        crop: { y: 330 },
      },
    ],
    grade: { vignette: 0.5, gradientBottom: 0.7, gradientTop: 0.4 },
    blocks: [
      { kind: 'text', style: 'kicker', text: '21:47 · late shift', y: 74, align: 'left', x: 70, w: 600 },
      { kind: 'text', style: 'typewriter', text: 'everyone has a match tonight.', y: 1062, size: 34 },
      { kind: 'text', style: 'headline', text: 'so do you.', y: 1110, size: 118 },
      { kind: 'lockup', y: 1272, scale: 0.56 },
    ],
    alt: 'An empty open-plan office at night, monitors dark, city lights in the windows. At the far wall a door stands open onto blinding white-green stadium light that spills across the carpet. Under the nearest desk sits an HNC football. Text: everyone has a match tonight. SO DO YOU.',
  },
  'autumn-05-poster': {
    id: 'autumn-05-poster',
    plates: [
      {
        spec: keyArt('05', { emre: { ...emre, look: 'hoodie' }, nikos: { ...nikos, look: 'hoodie' } }, {
          world: 'stage',
          set: { object: 'phone', me: 'emre', title: '🇹🇷 vs 🇬🇷 · no mercy', tone: 'navy', chat: [{ from: 'nikos', say: 'easy win' }, { from: 'emre', say: '😂' }, { from: 'emre', say: 'you sure?' }, { from: 'nikos', say: '🇬🇷🇬🇷🇬🇷' }, { from: 'emre', say: '1v1 then.' }] },
          beat: { duration: 1, camera: 'poster', cast: { emre: { at: 'out-right', do: { do: 'stare-down', lookAt: 'nikos' } }, nikos: { at: 'out-left', do: { do: 'stare-down', lookAt: 'emre' } } } },
        }),
        at: AT,
        crop: { y: 250 },
      },
    ],
    grade: { vignette: 0.45, gradientTop: 0.65, gradientBottom: 0.4 },
    blocks: [
      { kind: 'text', style: 'headline', text: 'say it\non the pitch.', x: 70, y: 70, w: 700, align: 'left', size: 104 },
      { kind: 'bubble', text: '1v1 then.', x: 600, y: 330, size: 66 },
      { kind: 'lockup', y: 1270, scale: 0.56, plate: true },
    ],
    alt: 'A giant smartphone stands like a monolith on a dark navy stage, its screen showing a group chat between Türkiye and Greece that ends with “1v1 then.” Two HNC characters in hoodies, Emre and Nikos, have stepped out of the screen and face each other at its base. Headline: SAY IT ON THE PITCH.',
  },
  'autumn-06-poster': {
    id: 'autumn-06-poster',
    plates: [
      {
        spec: keyArt('06', { lead: { country: 'TR', number: 29, name: 'Türkiye', look: 'kit' } }, { world: 'rooftop', set: { flag: 'TR', dawn: 0.95 }, beat: { duration: 1, camera: 'behind-wide', cast: { lead: { at: 'edge', do: 'proud' } } } }),
        at: AT,
        crop: { y: 300 },
      },
    ],
    grade: { vignette: 0.4, tint: '#b3121c', tintAlpha: 0.12, gradientBottom: 0.35 },
    blocks: [
      { kind: 'text', style: 'monument', text: '29 EKİM', y: 540, lang: 'tr', size: 170 },
      { kind: 'text', style: 'dedication', text: 'CUMHURİYET BAYRAMIMIZ\nKUTLU OLSUN', y: 735, lang: 'tr', size: 36 },
      { kind: 'lockup', y: 1262, scale: 0.5 },
    ],
    alt: 'Dawn over an original city silhouette with a strait and a suspension bridge. A large Turkish flag waves from a tall pole across the top of the image; below, seen from behind, an HNC player in a red Türkiye shirt with number 29 stands at a rooftop parapet facing the rising sun. Text: 29 EKİM · CUMHURİYET BAYRAMIMIZ KUTLU OLSUN.',
  },
  'autumn-07-poster': {
    id: 'autumn-07-poster',
    plates: [
      {
        spec: keyArt('07', { nikos, keeper: { person: 'keeper' } }, { world: 'football', set: { moment: 'midnight-penalty', roles: { striker: 'nikos', keeper: 'keeper' }, light: 'horror', crowd: 'empty' }, beat: { duration: 1, clock: { from: 9.3, to: 9.4 }, camera: 'goal-behind' } }),
        at: AT,
        crop: { y: 300 },
      },
    ],
    grade: { vignette: 0.7, gradientTop: 0.6, gradientBottom: 0.8, tint: '#0b1c3a', tintAlpha: 0.15 },
    blocks: [
      { kind: 'text', style: 'horror', text: 'the keeper\nwho doesn’t\nblink', y: 70, size: 96 },
      { kind: 'text', style: 'cinema', text: 'some keepers never sleep.', y: 1060, size: 30 },
      { kind: 'billing', lines: ['HNC League presents · a midnight penalty', 'an empty stadium · one floodlight · no crowd · 31.10'], y: 1128 },
      { kind: 'lockup', y: 1238, scale: 0.52 },
    ],
    alt: 'A horror-film poster: a night stadium drowned in fog under a single floodlight. A goalkeeper in purple stands dead centre on his goal line, staring straight out; far in the foreground a tiny striker in a blue Greece kit faces him alone. Title: THE KEEPER WHO DOESN’T BLINK. Tagline: some keepers never sleep.',
  },
  'autumn-08-poster': {
    id: 'autumn-08-poster',
    plates: [
      {
        spec: keyArt('08', { kaan: { person: 'kaan' } }, { world: 'studio', set: { screen: 'world-table', home: 'kaan' }, beat: { duration: 1, camera: 'poster-news', cast: { kaan: { at: 'anchor-centre', do: { do: 'present', lookAt: 'camera' } } } } }),
        at: AT,
        crop: { y: 260 },
      },
    ],
    grade: { vignette: 0.35, gradientBottom: 0.6 },
    blocks: [
      { kind: 'bug', text: 'HNC SPORTS' },
      { kind: 'breaking', label: 'Breaking', headline: 'The table is moving.', y: 930 },
      { kind: 'text', style: 'label', text: 'illustrative standings · not live data', y: 1152 },
      { kind: 'lockup', y: 1262, scale: 0.56 },
    ],
    alt: 'A sports-news studio. Kaan, an HNC anchor in a suit, sits at the desk gesturing to camera; behind him a wall screen shows the World Table. A red BREAKING graphic reads: THE TABLE IS MOVING. Small print: illustrative standings, not live data.',
  },
  'autumn-09-poster': {
    id: 'autumn-09-poster',
    background: '#05070c',
    plates: [
      {
        spec: keyArt('09a', { emre, lucas }, { world: 'breakroom', set: { display: 'machine-rematch', cup: false, cleared: true, sign: ['NO FOOTBALL', 'IN THE', 'KITCHEN'] }, beat: { duration: 1, camera: 'standoff-left', cast: { emre: { at: 'cup-left', do: { do: 'smug', lookAt: 'lucas' } }, lucas: { at: 'cup-right', do: { do: 'stare-down', lookAt: 'emre' } } } } }),
        at: AT,
        crop: { x: 160, y: 0, w: 768, h: 1920 },
        rect: { x: 0, y: 0, w: 537, h: 1350 },
      },
      {
        spec: keyArt('09b', { emre, lucas }, { world: 'breakroom', set: { display: 'machine-rematch', cup: false, cleared: true, sign: ['NO FOOTBALL', 'IN THE', 'KITCHEN'] }, beat: { duration: 1, camera: 'standoff-right', cast: { emre: { at: 'cup-left', do: { do: 'stare-down', lookAt: 'lucas' } }, lucas: { at: 'cup-right', do: { do: 'smug', lookAt: 'emre' } } } } }),
        at: AT,
        crop: { x: 152, y: 0, w: 768, h: 1920 },
        rect: { x: 543, y: 0, w: 537, h: 1350 },
      },
    ],
    grade: { vignette: 0.45, gradientBottom: 0.7, gradientTop: 0.5 },
    blocks: [
      { kind: 'rule', x: 537, y: 0, w: 6, h: 1350, color: '#f7bf30' },
      { kind: 'text', style: 'kicker', text: 'Türkiye vs Belgium · 12.11', y: 74 },
      { kind: 'text', style: 'impact', text: 'ROUND 2.', y: 1020, size: 168 },
      { kind: 'lockup', y: 1268, scale: 0.56, plate: true },
    ],
    alt: 'A split fight-poster: on the left Emre, an HNC office worker with a Turkish flag badge, smug; on the right Lucas, his Belgian coworker, staring back, both in the same office kitchen from The Coffee Machine Incident. A gold line splits the frame; big text: ROUND 2.',
  },
  'autumn-10-poster': {
    id: 'autumn-10-poster',
    plates: [
      {
        spec: keyArt('10', { emre: { ...emre, look: 'kit' } }, { world: 'corridor', beat: { duration: 1, camera: 'poster-tunnel', cast: { emre: { at: 'mouth', do: 'proud' } } } }),
        at: AT,
        crop: { y: 300 },
      },
    ],
    grade: { vignette: 0.6, gradientBottom: 0.75 },
    blocks: [
      { kind: 'text', style: 'cinema', text: 'one more.', y: 1060, size: 72 },
      { kind: 'lockup', y: 1250, scale: 0.56 },
    ],
    alt: 'Seen from behind in a dark stadium tunnel, an HNC player in a red Türkiye kit with the number 9 walks toward the blinding light of the pitch at the tunnel mouth. Minimal text: ONE MORE.',
  },
};

/** Where a poster lands in the campaign output tree. */
export function posterOutput(id: string): string {
  const item = CAMPAIGN.find((c) => c.poster === id);
  return item ? `${campaignDir(item)}/post.png` : `social/output/posters/${id}.png`;
}
