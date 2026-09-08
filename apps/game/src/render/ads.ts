/**
 * Pitch-side advertising boards — procedural brand-style art, zero assets.
 *
 * Boards-only placement (owner decision): the LinkedIn + GitHub creatives live
 * as canvas textures on the low ad boards around the pitch (see
 * `GameRenderer.buildStands`). They are display-only — the sim, netcode and
 * match flow never see them.
 *
 * Each creative is painted procedurally onto a 1024x128 canvas so the boards
 * stay crisp from the broadcast camera. No external images, fonts or fetches:
 * the game (and its offline PWA shell) renders them with the same canvas 2D
 * calls every boot.
 */

export interface FieldAd {
  /** Stable slot key, also used by tests. */
  id: 'linkedin' | 'github';
  /** Short line painted large, e.g. brand name. */
  title: string;
  /** Handle painted second, e.g. `/in/hunctasci`. */
  handle: string;
  /** Short CTA chip on the right edge. */
  cta: string;
  /** Board background. */
  base: string;
  /** Primary text / logo color. */
  ink: string;
  /** Profile URL (kept for menus/credits reuse; never fetched by the game). */
  url: string;
}

export const FIELD_ADS: FieldAd[] = [
  {
    id: 'linkedin',
    title: 'LinkedIn',
    handle: '/in/hunctasci',
    cta: 'CONNECT',
    base: '#0A66C2',
    ink: '#FFFFFF',
    url: 'https://www.linkedin.com/in/hunctasci/',
  },
  {
    id: 'github',
    title: 'GitHub',
    handle: '@hunctasci',
    cta: 'FOLLOW',
    base: '#0D1117',
    ink: '#FFFFFF',
    url: 'https://github.com/hunctasci',
  },
];

/** Board texture size — 8:1 matches the 9.6m x 1.15m board mesh. */
export const AD_W = 1024;
export const AD_H = 128;

/** Which creative a board slot shows. Boards alternate LinkedIn / GitHub. */
export function adForSlot(slot: number): FieldAd {
  const i = Number.isFinite(slot) ? Math.abs(Math.trunc(slot)) : 0;
  return FIELD_ADS[i % FIELD_ADS.length];
}

type Ctx2D = CanvasRenderingContext2D;

/**
 * Paint one brand-style creative. Pure canvas 2D — deterministic, no layout
 * reads, safe to call at boot. The two creatives share geometry (logo badge
 * left, title+handle centre-left, CTA chip right) so the stadium reads as a
 * real sponsor rotation instead of two unrelated signs.
 */
export function paintAd(ctx: Ctx2D, ad: FieldAd, w = AD_W, h = AD_H): void {
  // Background + subtle top light edge (floodlit sheen) + dark base line.
  ctx.fillStyle = ad.base;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, 0, w, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h - 8, w, 8);

  if (ad.id === 'linkedin') {
    // White rounded badge with the "in" wordmark in LinkedIn blue.
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 28, 22, 84, 84, 14);
    ctx.fill();
    ctx.fillStyle = '#0A66C2';
    ctx.font = '900 56px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('in', 70, 68);
    // Title + handle.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 52px Arial, sans-serif';
    ctx.fillText('LinkedIn', 136, 56);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '500 34px Arial, sans-serif';
    ctx.fillText('/in/hunctasci', 138, 96);
  } else {
    // GitHub mark: white ring (octocat head abstraction) + "cat" ears.
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(70, 66, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(46, 44);
    ctx.lineTo(40, 24);
    ctx.lineTo(58, 34);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(94, 44);
    ctx.lineTo(100, 24);
    ctx.lineTo(82, 34);
    ctx.closePath();
    ctx.fill();
    // Title + handle.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 52px Arial, sans-serif';
    ctx.fillText('GitHub', 136, 56);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '500 34px Arial, sans-serif';
    ctx.fillText('@hunctasci', 138, 96);
    // Thin green status underline — github-flavoured accent.
    ctx.fillStyle = '#3FB950';
    ctx.fillRect(136, 106, 220, 5);
  }

  // CTA chip, right edge: outlined pill with centred label.
  const label = ad.cta;
  ctx.font = '900 30px Arial, sans-serif';
  const tw = ctx.measureText(label).width;
  const cw = tw + 56;
  const cx = w - cw - 30;
  const cy = 34;
  const ch = 60;
  ctx.strokeStyle = ad.id === 'linkedin' ? '#FFFFFF' : '#3FB950';
  ctx.lineWidth = 4;
  roundRect(ctx, cx, cy, cw, ch, ch / 2);
  ctx.stroke();
  ctx.fillStyle = ad.id === 'linkedin' ? '#FFFFFF' : '#3FB950';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx + cw / 2, cy + ch / 2 + 1);
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
