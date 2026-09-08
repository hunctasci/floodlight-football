import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CONSENT_KEY, GTM_ID, getConsent, initAnalytics, needsConsent, setConsent, showConsentBanner, track } from '../src/analytics.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(here, '..', 'src', 'main.ts'), 'utf8');
const indexHtml = readFileSync(join(here, '..', 'index.html'), 'utf8');

// GTM loader is production-only: dev/tests/E2E never hit the network.
// (initAnalytics always pushes the inert consent-default array.)
test('analytics boots silently outside production', () => {
  const g = globalThis as unknown as { dataLayer?: unknown };
  (globalThis as unknown as { dataLayer: unknown }).dataLayer = [];
  initAnalytics();
  const dl = (globalThis as unknown as { dataLayer: unknown[] }).dataLayer;
  assert.ok(!dl.some((e) => !Array.isArray(e) && (e as Record<string, unknown>).event === 'gtm.js'),
    'no gtm.js injection outside PROD builds');
  assert.ok(dl.some((e) => Array.isArray(e) && e[0] === 'consent'), 'consent default still pushed');
  void g;
});

// Custom game events land on the dataLayer for GTM triggers.
test('track() pushes game events without a DOM', () => {
  track('match_start', { mode: 'solo' });
  track('goal', { a: 1, b: 0 });
  const dl = (globalThis as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
  assert.ok(dl.some((e) => e.event === 'match_start' && e.mode === 'solo'));
  assert.ok(dl.some((e) => e.event === 'goal'));
  // Cleanup so other suites see a pristine layer.
  (globalThis as unknown as { dataLayer: unknown }).dataLayer = undefined;
});

// Container id matches the owner's GTM property.
test('container id is GTM-PVR3NWLQ', () => {
  assert.equal(GTM_ID, 'GTM-PVR3NWLQ');
});

// No hardcoded GTM snippet in the shell: injection is PROD-gated in code,
// so sandboxed/offline runs stay hermetic.
test('index shell stays static (no third-party tags)', () => {
  assert.ok(!indexHtml.includes('googletagmanager'), 'no GTM in index.html');
  assert.ok(!indexHtml.includes('GTM-'), 'no container id in index.html');
});

// Lifecycle wiring: the events GTM triggers consume actually fire.
test('main wires the analytics lifecycle', () => {
  assert.ok(mainSrc.includes('initAnalytics()'), 'boot initializes analytics');
  for (const evt of ["track('match_start'", "track('goal'", "track('match_end'", "track('online_connected'", "track('online_error'"]) {
    assert.ok(mainSrc.includes(evt), `main fires ${evt}`);
  }
});

// Consent Mode v2: denied-by-default, persisted choice, gated loader.
test('consent defaults to undecided, persists the choice', () => {
  const g = globalThis as unknown as { dataLayer?: unknown; __consentMem?: Map<string, string> };
  // Isolate from both backings (Node 25 ships a real localStorage).
  g.__consentMem = new Map();
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* no DOM storage */ }
  assert.equal(getConsent(), null);
  assert.equal(needsConsent(), true);
  setConsent('denied');
  assert.equal(getConsent(), 'denied');
  assert.equal(needsConsent(), false);
  setConsent('granted');
  assert.equal(getConsent(), 'granted');
  g.__consentMem = new Map();
  assert.ok(String(CONSENT_KEY).length > 0, 'storage key defined');
});

test('init pushes denied-by-default before anything else', () => {
  (globalThis as unknown as { dataLayer: unknown }).dataLayer = [];
  (globalThis as unknown as { __consentMem?: Map<string, string> }).__consentMem = new Map();
  initAnalytics();
  const dl = (globalThis as unknown as { dataLayer: unknown[] }).dataLayer;
  const first = dl[0] as unknown[];
  assert.ok(Array.isArray(first) && first[0] === 'consent' && first[1] === 'default', 'consent default leads');
  assert.equal((first[2] as Record<string, string>).analytics_storage, 'denied');
  (globalThis as unknown as { dataLayer: unknown }).dataLayer = undefined;
  (globalThis as unknown as { __consentMem?: Map<string, string> }).__consentMem = undefined;
});

test('banner needs a DOM (headless-safe no-op)', () => {
  assert.equal(showConsentBanner(), null);
});

// Banner + gating wired at boot.
test('main asks for consent at boot and gates the loader', () => {
  assert.ok(mainSrc.includes('needsConsent'), 'boot checks for a stored choice');
  assert.ok(mainSrc.includes('showConsentBanner()'), 'banner shown when undecided');
  assert.ok(cssContainsConsent(), 'banner styled');
});

function cssContainsConsent(): boolean {
  return readFileSync(join(here, '..', 'src', 'style.css'), 'utf8').includes('.consent');
}
