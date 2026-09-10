import logoUrl from '../../../../apps/game/public/icons/hnc-retro-v2.png?url';
import { BRAND_DOMAIN } from './presets';
import type { EvaluatedOverlay, OverlayFrameDescription } from './types';

/**
 * DOM renderer for evaluated overlays. Writes absolute opacity/transform
 * values computed by `evaluate.ts` — never CSS animations, never wall
 * clocks. All copy is set via `textContent` (never innerHTML) so
 * AI-supplied text always renders literally.
 */

export const OVERLAY_ROOT_ID = 'hnc-social-overlays';

let logoPreload: Promise<boolean> | null = null;
let logoAvailable = false;

/**
 * Preload + validate the brand logo once during harness startup. The file is
 * decoded AND pixel-checked: a corrupt-but-loadable PNG (complete with
 * naturalWidth yet zero content pixels) must fall back to the text lockup
 * instead of painting an empty box. Resolves true when the logo paints real
 * pixels, false otherwise. The per-frame renderer stays synchronous; call
 * this before signalling readiness.
 */
export function ensureOverlayAssets(): Promise<boolean> {
  if (logoPreload) return logoPreload;
  logoPreload = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const probe = document.createElement('canvas');
        probe.width = 8;
        probe.height = 8;
        const ctx = probe.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let sum = 0;
        for (const v of data) sum += v;
        logoAvailable = sum > 0;
      } catch {
        logoAvailable = false;
      }
      resolve(logoAvailable);
    };
    img.onerror = () => resolve(false);
    img.src = logoUrl;
  });
  return logoPreload;
}

/** Whether the brand logo validated (call after ensureOverlayAssets). */
export function isLogoAvailable(): boolean {
  return logoAvailable;
}

/** After rendering a frame, wait for a freshly created brand image if needed. */
export async function ensureBrandLogoReady(host: HTMLElement): Promise<void> {
  const img = host.querySelector('img');
  if (!img) return;
  const done = img as HTMLImageElement;
  if (done.complete && done.naturalWidth > 0) return;
  try {
    await done.decode();
  } catch {
    /* brand falls back to the domain text */
  }
}

function styleNode(el: HTMLElement, ov: EvaluatedOverlay): void {
  el.style.opacity = String(ov.opacity);
  el.style.transform = `translate(${ov.translateX}px, ${ov.translateY}px) scale(${ov.scale})`;
}

function teamRow(doc: Document, flag: string, name: string): HTMLElement {
  const row = doc.createElement('div');
  row.className = 'hnc-ov-team';
  const flagEl = doc.createElement('span');
  flagEl.className = 'hnc-ov-flag';
  flagEl.textContent = flag;
  const nameEl = doc.createElement('span');
  nameEl.className = 'hnc-ov-name';
  nameEl.textContent = name;
  row.appendChild(flagEl);
  row.appendChild(nameEl);
  return row;
}

function buildVersus(doc: Document, ov: EvaluatedOverlay): HTMLElement {
  const box = doc.createElement('div');
  const versus = ov.versus;
  if (!versus) {
    box.className = 'hnc-ov hnc-ov-versus';
    return box;
  }
  if (versus.layout === 'strip') {
    box.className = 'hnc-ov hnc-ov-versus hnc-ov-strip';
    const pill = doc.createElement('div');
    pill.className = 'hnc-ov-pill';
    const homeFlag = doc.createElement('span');
    homeFlag.className = 'hnc-ov-flag-inline';
    homeFlag.textContent = versus.homeFlag;
    const homeName = doc.createElement('span');
    homeName.className = 'hnc-ov-name-inline';
    homeName.textContent = versus.homeName;
    const vs = doc.createElement('span');
    vs.className = 'hnc-ov-vs-inline';
    vs.textContent = 'VS';
    const awayName = doc.createElement('span');
    awayName.className = 'hnc-ov-name-inline';
    awayName.textContent = versus.awayName;
    const awayFlag = doc.createElement('span');
    awayFlag.className = 'hnc-ov-flag-inline';
    awayFlag.textContent = versus.awayFlag;
    pill.appendChild(homeFlag);
    pill.appendChild(homeName);
    pill.appendChild(vs);
    pill.appendChild(awayName);
    pill.appendChild(awayFlag);
    box.appendChild(pill);
    return box;
  }
  box.className = 'hnc-ov hnc-ov-versus hnc-ov-stacked';
  box.appendChild(teamRow(doc, versus.homeFlag, versus.homeName));
  const vs = doc.createElement('div');
  vs.className = 'hnc-ov-vs';
  vs.textContent = 'VS';
  box.appendChild(vs);
  box.appendChild(teamRow(doc, versus.awayFlag, versus.awayName));
  return box;
}

function buildText(doc: Document, className: string, text: string | undefined): HTMLElement {
  const box = doc.createElement('div');
  box.className = className;
  const main = doc.createElement('div');
  main.className = 'hnc-ov-main';
  main.textContent = text ?? '';
  box.appendChild(main);
  return box;
}

function buildHeadline(doc: Document, ov: EvaluatedOverlay): HTMLElement {
  const box = buildText(doc, 'hnc-ov hnc-ov-headline', ov.text);
  if (ov.secondary !== undefined) {
    const sub = doc.createElement('div');
    sub.className = 'hnc-ov-secondary';
    sub.textContent = ov.secondary;
    box.appendChild(sub);
  }
  return box;
}

function buildBrand(doc: Document): HTMLElement {
  const box = doc.createElement('div');
  box.className = 'hnc-ov hnc-ov-brand';
  if (isLogoAvailable()) {
    const img = doc.createElement('img');
    img.className = 'hnc-ov-logo';
    img.src = logoUrl;
    img.alt = 'HNC League';
    img.draggable = false;
    box.appendChild(img);
  } else {
    // Canonical logo file unreadable: deterministic styled-text lockup in
    // the same HNC voice. Dropping a valid PNG at the logo path upgrades
    // this to the image lockup with no code changes.
    const wordmark = doc.createElement('div');
    wordmark.className = 'hnc-ov-wordmark';
    wordmark.textContent = 'HNC LEAGUE';
    box.appendChild(wordmark);
  }
  const domain = doc.createElement('div');
  domain.className = 'hnc-ov-domain';
  domain.textContent = BRAND_DOMAIN;
  box.appendChild(domain);
  return box;
}

function buildOverlay(doc: Document, ov: EvaluatedOverlay): HTMLElement {
  switch (ov.kind) {
    case 'versus':
      return buildVersus(doc, ov);
    case 'headline':
      return buildHeadline(doc, ov);
    case 'goal':
      return buildText(doc, 'hnc-ov hnc-ov-goal', ov.text);
    case 'cta':
      return buildText(doc, 'hnc-ov hnc-ov-cta', ov.text);
    case 'brand':
      return buildBrand(doc);
  }
}

/**
 * Render one evaluated overlay frame into the host container. Deterministic:
 * the host is rebuilt from the description every frame, so any frame
 * renders standalone.
 */
export function renderOverlays(desc: OverlayFrameDescription, host?: HTMLElement): void {
  const root = host ?? document.getElementById(OVERLAY_ROOT_ID);
  if (!root) return;
  while (root.firstChild) root.removeChild(root.firstChild);
  if (desc.overlays.length === 0) {
    root.style.display = 'none';
    return;
  }
  root.style.display = '';
  const doc = root.ownerDocument;
  for (const ov of desc.overlays) {
    const node = buildOverlay(doc, ov);
    styleNode(node, ov);
    root.appendChild(node);
  }
}
