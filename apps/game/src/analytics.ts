/**
 * Analytics: GA4 via gtag.js + game-event dataLayer pushes + consent.
 *
 * - The gtag.js loader is injected ONLY in production builds AND only after
 *   the player accepts tracking. Dev, tests and the Playwright E2E never
 *   touch googletagmanager.com (offline PWA shell and sandboxed CI stay
 *   hermetic; the noscript iframe is pointless for a JS-only WebGL game).
 * - Consent Mode v2: denied-by-default is pushed before anything else, so
 *   GA4 collection stays dormant until the player opts in. The choice
 *   persists in localStorage (`floodlight-consent`).
 * - `track()` pushes `{ event, ...params }` objects onto the global
 *   dataLayer in every environment (a side-effect-free array push); with
 *   gtag.js loaded these are collected as GA4 custom events automatically:
 *   match_start, goal, match_end, online_connected, online_error.
 * - Analytics never throws and never blocks gameplay.
 */

export const GA_ID = 'G-YTNJDKH5V0';
export const CONSENT_KEY = 'floodlight-consent';

export type ConsentChoice = 'granted' | 'denied';

type DataLayer = Array<Record<string, unknown> | unknown[]>;

function layer(): DataLayer {
  const g = globalThis as unknown as { dataLayer?: unknown };
  if (!Array.isArray(g.dataLayer)) g.dataLayer = [];
  return g.dataLayer as DataLayer;
}

function isProd(): boolean {
  try {
    return (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD ?? false;
  } catch {
    return false;
  }
}

/**
 * Storage: in-memory source of truth, localStorage mirror for persistence.
 * Memory-first because DOM storage can be present-but-unwritable (private
 * mode, sandboxed frames) — reads must see our own writes regardless.
 */
function store(): { get(k: string): string | null; set(k: string, v: string): void } {
  const g = globalThis as unknown as { __consentMem?: Map<string, string> };
  const mem = (g.__consentMem ??= new Map<string, string>());
  let ls: Storage | null = null;
  try {
    ls = typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    ls = null;
  }
  return {
    get: (k) => {
      const m = mem.get(k);
      if (m !== undefined) return m;
      try {
        return ls?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      mem.set(k, v);
      try {
        ls?.setItem(k, v);
      } catch {
        /* session-only */
      }
    },
  };
}

/** Stored tracking choice, or null when the player hasn't decided. */
export function getConsent(): ConsentChoice | null {
  try {
    const v = store().get(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

function pushConsent(state: 'default' | 'update', choice: ConsentChoice): void {
  try {
    layer().push([
      'consent',
      state,
      {
        ad_storage: choice,
        ad_user_data: choice,
        ad_personalization: choice,
        analytics_storage: choice,
        functionality_storage: choice,
        personalization_storage: choice,
        security_storage: 'granted',
      },
    ]);
  } catch {
    /* ignore */
  }
}

/** Persist a choice, push the Consent Mode update, load GTM on accept. */
export function setConsent(choice: ConsentChoice): void {
  try {
    store().set(CONSENT_KEY, choice);
  } catch {
    /* private mode: session-only */
  }
  pushConsent('update', choice);
  if (choice === 'granted') injectGtag();
}

/** True when the banner must be shown (no stored choice). */
export function needsConsent(): boolean {
  return getConsent() === null;
}

function injectGtag(): void {
  if (!isProd()) return;
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[data-gtag="${GA_ID}"]`)) return;
  try {
    // gtag() bootstrap: queue the js/config commands the loader consumes.
    layer().push(['js', new Date()] as unknown as Record<string, unknown>);
    layer().push(['config', GA_ID] as unknown as Record<string, unknown>);
    const s = document.createElement('script');
    s.async = true;
    s.dataset.gtag = GA_ID;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
  } catch {
    /* analytics never breaks the game */
  }
}

/**
 * Boot analytics: push denied-by-default first (GA4 stays dormant), then
 * load immediately only for previously-accepting players. New players
 * decide via `showConsentBanner()`.
 */
export function initAnalytics(): void {
  try {
    pushConsent('default', 'denied');
    if (getConsent() === 'granted') injectGtag();
  } catch {
    /* ignore */
  }
}

/**
 * Consent banner. Rendered outside the game's `.ui` layer (menus/HUD rewrite
 * that node constantly) with pointer events only on itself, so it can never
 * swallow gameplay input. Returns the element, or null without a DOM.
 */
export function showConsentBanner(onChoice?: (c: ConsentChoice) => void): HTMLElement | null {
  try {
    if (typeof document === 'undefined') return null;
    if (document.querySelector('[data-testid="consent-banner"]')) return null;
    const bar = document.createElement('div');
    bar.className = 'consent';
    bar.setAttribute('data-testid', 'consent-banner');
    bar.innerHTML =
      `<span class="consent-text">WE USE COOKIES FOR ANALYTICS — YOUR CALL, COACH.</span>` +
      `<span class="consent-btns">` +
      `<button class="consent-btn accept" data-testid="consent-accept">ACCEPT</button>` +
      `<button class="consent-btn decline" data-testid="consent-decline">DECLINE</button>` +
      `</span>`;
    const pick = (c: ConsentChoice) => {
      try {
        setConsent(c);
        onChoice?.(c);
        bar.remove();
      } catch {
        /* ignore */
      }
    };
    bar.querySelector('.consent-btn.accept')?.addEventListener('click', () => pick('granted'));
    bar.querySelector('.consent-btn.decline')?.addEventListener('click', () => pick('denied'));
    (document.getElementById('app') ?? document.body).appendChild(bar);
    return bar;
  } catch {
    return null;
  }
}

/** Push a custom event for GTM triggers (match_start, goal, match_end, …). */
export function track(event: string, params: Record<string, unknown> = {}): void {
  try {
    layer().push({ event, ...params });
  } catch {
    /* ignore */
  }
}
