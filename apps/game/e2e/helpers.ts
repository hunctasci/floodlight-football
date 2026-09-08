import { expect, type Browser, type Page } from '@playwright/test';

export interface TestDiag {
  getScreen(): string;
  getRoomCode(): string;
  getInviteUrl(): string;
  getOnlinePeerId(): string;
  getRemotePeerId(): string;
  getNetStatus(): string;
  getMpState(): string;
  getReady(): { iAmReady: boolean; peerReady: boolean };
  getNetState(): string;
  hasNetSession(): boolean;
  isE2E(): boolean;
  getSimulationState(): {
    tick: number;
    hash: number;
    score: number[];
    half: number;
    phase: string;
    elapsed: number;
    screen: string;
    mpState: string;
    roomCode: string;
  };
}

export async function testState(page: Page): Promise<TestDiag['getSimulationState'] & { screen: string; mpState: string; roomCode: string; peerId: string; netState: string }> {
  return page.evaluate(() => {
    const t = (window as unknown as { __floodlightTest?: {
      getScreen(): string; getRoomCode(): string; getOnlinePeerId(): string;
      getMpState(): string; getNetState(): string;
      getSimulationState(): { tick: number; hash: number; score: number[]; half: number; phase: string; elapsed: number; screen: string; mpState: string; roomCode: string };
    } }).__floodlightTest;
    if (!t) throw new Error('missing __floodlightTest (is DEV/e2e hook exposed?)');
    const s = t.getSimulationState();
    return { ...s, screen: t.getScreen(), mpState: t.getMpState(), roomCode: t.getRoomCode(), peerId: t.getOnlinePeerId(), netState: t.getNetState() };
  });
}

export async function peerIds(page: Page): Promise<{ mine: string; remote: string; room: string }> {
  return page.evaluate(() => {
    const t = (window as unknown as { __floodlightTest?: {
      getOnlinePeerId(): string; getRemotePeerId(): string; getRoomCode(): string;
    } }).__floodlightTest!;
    return { mine: t.getOnlinePeerId(), remote: t.getRemotePeerId(), room: t.getRoomCode() };
  });
}

export function attachErrorCollectors(page: Page, tag: string, store: { errors: string[]; failed: string[] }) {
  page.on('console', (m) => {
    if (m.type() === 'error') store.errors.push(`[${tag}] ${m.text().slice(0, 400)}`);
  });
  page.on('pageerror', (e) => store.errors.push(`[${tag}] pageerror: ${String(e).slice(0, 400)}`));
  page.on('requestfailed', (r) => {
    const url = r.url();
    if (url.includes('stun:') || url.includes('google')) return;
    store.failed.push(`[${tag}] ${url.slice(0, 200)} ${r.failure()?.errorText ?? ''}`);
  });
}

export function assertNoBadErrors(errors: string[], failed: string[]) {
  const benign = [/favicon/i, /manifest/i, /stun/i, /google/i];
  const real = errors.filter((e) => !benign.some((b) => b.test(e)));
  assertNoLeak(real.join('\n'));
  expect(real, `console/page errors:\n${real.join('\n')}`).toEqual([]);
  const badReq = failed.filter((f) => !f.includes('/api/health'));
  expect(badReq, `failed requests:\n${badReq.join('\n')}`).toEqual([]);
}

function assertNoLeak(text: string) {
  // SDP/ICE bodies must never be dumped to console output in tests.
  expect(text).not.toMatch(/v=0\r?\no=-/);
}

export async function openOnlineMenu(page: Page, opts: { e2e?: boolean } = {}) {
  await page.goto(opts.e2e === false ? '/' : '/?e2e=1');
  await enterOnlineMenu(page);
}

/** ONLINE MATCH from the title screen without reloading (same page lifetime). */
export async function enterOnlineMenu(page: Page) {
  await expect(page.getByText('ONLINE MATCH').first()).toBeVisible({ timeout: 15_000 });
  await page.getByText('ONLINE MATCH').first().click();
  await expect(page.getByText('PLAY WITH A FRIEND').first()).toBeVisible({ timeout: 10_000 });
}

export async function createFriendRoom(page: Page): Promise<{ roomCode: string }> {
  await page.getByText('PLAY WITH A FRIEND').first().click();
  // Host screen appears immediately (CREATING ROOM...), the readable code
  // arrives after POST /api/rooms. Display is grouped (ABC DEF): strip it.
  await expect(page.getByTestId('room-code')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => {
    const t = await page.getByTestId('room-code').textContent().catch(() => '');
    return (t ?? '').replace(/[^A-HJ-NP-Z2-9]/g, '');
  }, { timeout: 15_000 }).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  const shown = await page.getByTestId('room-code').textContent();
  const roomCode = (shown ?? '').replace(/[^A-HJ-NP-Z2-9]/g, '');
  // Read-out grouping for humans: 3 + 3.
  expect(shown?.trim()).toMatch(/^[A-HJ-NP-Z2-9]{3} [A-HJ-NP-Z2-9]{3}$/);
  return { roomCode };
}

/** Full guest flow from a fresh page load: menu → JOIN WITH CODE → submit. */
export async function joinAsGuest(page: Page, code: string, opts: { e2e?: boolean } = {}) {
  await openOnlineMenu(page, opts);
  await joinWithCode(page, code);
}

export async function waitForReadyLobby(page: Page, timeout = 30_000) {
  await expect(page.getByTestId('ready-room')).toBeVisible({ timeout });
  await page.waitForFunction(
    () => (window as unknown as { __floodlightTest?: { getScreen(): string } }).__floodlightTest?.getScreen() === 'netready',
    { timeout },
  );
}

export async function setReady(page: Page) {
  await expect(page.getByText("I'M READY").first()).toBeVisible({ timeout: 10_000 });
  await page.getByText("I'M READY").first().click();
}

export async function waitForMatch(page: Page, timeout = 30_000) {
  await page.waitForFunction(
    () => (window as unknown as { __floodlightTest?: { getScreen(): string } }).__floodlightTest?.getScreen() === 'match',
    { timeout },
  );
}

export async function waitForFullTime(page: Page, timeout = 120_000) {
  await page.waitForFunction(
    () => (window as unknown as { __floodlightTest?: { getScreen(): string } }).__floodlightTest?.getScreen() === 'full',
    { timeout },
  );
  await expect(page.getByTestId('fulltime-title')).toBeVisible({ timeout: 10_000 });
}

export async function joinWithCode(page: Page, code: string) {
  await page.getByText('JOIN WITH CODE').first().click();
  await expect(page.getByTestId('join-code-input')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('join-code-input').fill(code);
  await page.getByTestId('join-submit').click();
}

export async function dumpBoth(host: Page, guest: Page): Promise<string> {
  const h = await testState(host).catch((e) => ({ error: String(e) }));
  const g = await testState(guest).catch((e) => ({ error: String(e) }));
  return `HOST: ${JSON.stringify(h)}\nGUEST: ${JSON.stringify(g)}`;
}

/** Send real gameplay controls through the actual keyboard layer. */
export async function playInputBurst(page: Page, kind: 'move' | 'pass' | 'shoot' | 'switch') {
  if (kind === 'move') {
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(350);
    await page.keyboard.up('ArrowRight');
  } else if (kind === 'pass') {
    await page.keyboard.press('s');
  } else if (kind === 'shoot') {
    await page.keyboard.down('k');
    await page.waitForTimeout(250);
    await page.keyboard.up('k');
  } else {
    await page.keyboard.press('Space');
  }
}

export async function newIsolatedPages(browser: Browser): Promise<{ host: Page; guest: Page; close(): Promise<void> }> {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  return {
    host,
    guest,
    close: async () => {
      await hostCtx.close().catch(() => {});
      await guestCtx.close().catch(() => {});
    },
  };
}
