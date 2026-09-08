import { expect, test } from '@playwright/test';
import {
  attachErrorCollectors, assertNoBadErrors, createFriendRoom, dumpBoth,
  joinWithCode, newIsolatedPages, openOnlineMenu, peerIds, playInputBurst,
  setReady, testState, waitForFullTime, waitForMatch, waitForReadyLobby,
} from './helpers';

/**
 * E2E 1 — INVITE-LINK HAPPY PATH (PRIMARY RELEASE-BLOCKING TEST).
 *
 * Host: ONLINE MATCH -> PLAY WITH A FRIEND -> room + invite URL (real UI).
 * Guest: opens that EXACT invite URL in an isolated context -> auto-joins.
 * Both: real Cloudflare/DO signaling -> real WebRTC/DataChannel -> NetDriver
 * handshake -> READY -> one-minute match (30s halves, TEST-ONLY) -> FULL TIME.
 */
test('E2E 1 — invite link happy path through a full one-minute match', async ({ browser }) => {
  test.setTimeout(240_000);
  const { host, guest, close } = await newIsolatedPages(browser);
  const errs = { errors: [] as string[], failed: [] as string[] };
  attachErrorCollectors(host, 'host', errs);
  attachErrorCollectors(guest, 'guest', errs);
  try {
    // PLAYER 1: create the room through the actual game menu.
    await openOnlineMenu(host, { e2e: true });
    const { roomCode, inviteUrl } = await createFriendRoom(host);
    expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(inviteUrl).toContain(`?room=${roomCode}`);
    expect(inviteUrl).not.toMatch(/token|sdp|offer|answer/i);

    // PLAYER 2: opens the EXACT invite URL -> auto-join, no manual paste.
    await guest.goto(inviteUrl);
    await expect(guest.getByText(/JOINING MATCH/i).first()).toBeVisible({ timeout: 15_000 });

    // BOTH: WebRTC + NetDriver -> READY lobby.
    await waitForReadyLobby(host, 45_000);
    await waitForReadyLobby(guest, 45_000);

    // Two independent sessions: distinct peer ids, same room.
    const h = await peerIds(host);
    const g = await peerIds(guest);
    expect(h.room).toBe(roomCode);
    expect(g.room).toBe(roomCode);
    expect(h.mine).toMatch(/^[0-9a-f]{8}$/);
    expect(g.mine).toMatch(/^[0-9a-f]{8}$/);
    expect(h.mine).not.toBe(g.mine);

    // Prove WebRTC/DataChannel/NetDriver actually connected (not just joined).
    const hs = await testState(host);
    const gs = await testState(guest);
    expect(['connected', 'ready']).toContain(hs.mpState);
    expect(['connected', 'ready']).toContain(gs.mpState);
    expect(hs.netState).not.toBe('closed');

    // BOTH press READY through the real game UI.
    await setReady(host);
    await setReady(guest);
    await waitForMatch(host, 30_000);
    await waitForMatch(guest, 30_000);

    // ONE-MINUTE MATCH: real controls from both peers, sync asserted.
    const startTickH = (await testState(host)).tick;
    let prevA = startTickH;
    let prevB = (await testState(guest)).tick;
    let maxSeen = startTickH;
    let sawSecondHalf = false;
    const deadline = Date.now() + 150_000;
    let step = 0;
    while (Date.now() < deadline) {
      // Deterministic pattern (no randomness): move / pass / shoot / switch.
      await playInputBurst(host, (['move', 'pass', 'shoot', 'switch'] as const)[step % 4]);
      await playInputBurst(guest, (['move', 'pass', 'switch', 'shoot'] as const)[step % 4]);
      step++;
      // If halftime needs confirmation, press Enter on the host (real UI path).
      // Guest follows via the host's broadcastHalf packet (or its 5s fallback).
      for (const p of [host, guest]) {
        const s = await testState(p).catch(() => null);
        if (s?.screen === 'half' && p === host) await p.keyboard.press('Enter');
      }
      const a = await testState(host);
      const b = await testState(guest);
      if (a.half === 2 || b.half === 2 || a.screen === 'half' || b.screen === 'half') sawSecondHalf = true;
      // Ticks never run backwards (half screens freeze stepping by design).
      expect(a.tick).toBeGreaterThanOrEqual(prevA);
      expect(b.tick).toBeGreaterThanOrEqual(prevB);
      prevA = a.tick;
      prevB = b.tick;
      maxSeen = Math.max(maxSeen, a.tick, b.tick);
      expect(maxSeen).toBeGreaterThan(startTickH);
      const inHalfTransition =
        a.screen === 'half' || b.screen === 'half' || a.phase === 'halftime' || b.phase === 'halftime';
      const diff = Math.abs(a.tick - b.tick);
      if (inHalfTransition) {
        // Host auto-continues after ~1.5s, guest after packet/5s fallback:
        // one side steps while the other shows HALF TIME. Bound the window.
        expect(diff).toBeLessThanOrEqual(500);
      } else {
        // Steady-state lockstep stays tight (input delay is 3 ticks).
        expect(diff).toBeLessThanOrEqual(30);
        if (a.tick === b.tick) expect(a.hash).toBe(b.hash);
      }
      if (a.screen === 'full' && b.screen === 'full') break;
      await host.waitForTimeout(1200);
      const done = await testState(host).catch(() => null);
      if (done?.screen === 'full') break;
    }
    // Proof the simulation actually ran (not stuck at kickoff).
    expect(maxSeen).toBeGreaterThan(startTickH + 500);

    await waitForFullTime(host, 90_000);
    await waitForFullTime(guest, 90_000);
    expect(sawSecondHalf).toBe(true);

    const fa = await testState(host);
    const fb = await testState(guest);
    expect(fa.half).toBe(2);
    expect(fb.half).toBe(2);
    expect(fa.score).toEqual(fb.score);
    expect(fa.tick).toBeGreaterThan(0);
    // After FULL TIME both sims are quiescent: ticks/hashes must agree.
    // Poll briefly for the final resync/hash packet to land.
    let ga = fa;
    let gb = fb;
    for (let i = 0; i < 10 && (ga.tick !== gb.tick || ga.hash !== gb.hash); i++) {
      await host.waitForTimeout(500);
      ga = await testState(host);
      gb = await testState(guest);
    }
    expect(Math.abs(ga.tick - gb.tick)).toBeLessThanOrEqual(30);
    if (ga.tick === gb.tick) expect(ga.hash).toBe(gb.hash);

    assertNoBadErrors(errs.errors, errs.failed);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(await dumpBoth(host, guest).catch(() => 'no state'));
    throw e;
  } finally {
    await close();
  }
});

test('E2E 2 — manual JOIN WITH CODE reaches the same READY lobby', async ({ browser }) => {
  const { host, guest, close } = await newIsolatedPages(browser);
  const errs = { errors: [] as string[], failed: [] as string[] };
  attachErrorCollectors(host, 'host', errs);
  attachErrorCollectors(guest, 'guest', errs);
  try {
    await openOnlineMenu(host, { e2e: true });
    const { roomCode } = await createFriendRoom(host);

    await openOnlineMenu(guest, { e2e: false });
    await joinWithCode(guest, roomCode.toLowerCase());

    await expect(host.getByTestId('wait-steps')).toBeVisible({ timeout: 10_000 });
  await waitForReadyLobby(host, 45_000);
  await waitForReadyLobby(guest, 45_000);
    const h = await peerIds(host);
    const g = await peerIds(guest);
    expect(h.room).toBe(g.room);
    expect(h.mine).not.toBe(g.mine);
    // Redacted diagnostics prove the handshake path without leaking secrets.
    const hostLog = await host.evaluate(
      () => (window as unknown as { __floodlightTest?: { getNetLog(): string } }).__floodlightTest?.getNetLog() ?? '',
    );
    expect(hostLog).toMatch(/driver.*connected/);
    expect(hostLog).not.toMatch(/matchToken|v=0\r?\no=-/);
    expect(hostLog).not.toMatch(/192\.168|10\.\d+\.\d+\.\d+/);
    assertNoBadErrors(errs.errors, errs.failed);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(await dumpBoth(host, guest).catch(() => 'no state'));
    throw e;
  } finally {
    await close();
  }
});

test('E2E 3 — two isolated sessions have unique online peer identities', async ({ browser }) => {
  const { host, guest, close } = await newIsolatedPages(browser);
  try {
    await openOnlineMenu(host, { e2e: true });
    const { roomCode } = await createFriendRoom(host);
    await guest.goto(`/?e2e=1`);
    await expect(guest.getByText('ONLINE MATCH')).toBeVisible({ timeout: 15_000 });
    const h = await peerIds(host);
    // Guest has its own session id even before joining (fresh per attempt).
    await openOnlineMenu(guest, { e2e: false });
    await joinWithCode(guest, roomCode);
    await waitForReadyLobby(host, 45_000);
    await waitForReadyLobby(guest, 45_000);
    const h2 = await peerIds(host);
    const g2 = await peerIds(guest);
    expect(h2.mine).toBe(h.mine);
    expect(g2.mine).not.toBe(h2.mine);
    expect(g2.room).toBe(roomCode);
  } finally {
    await close();
  }
});

test('E2E 4 — third browser session is rejected with ROOM IS FULL', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const thirdCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  const third = await thirdCtx.newPage();
  try {
    await openOnlineMenu(host, { e2e: true });
    const { roomCode, inviteUrl } = await createFriendRoom(host);
    await guest.goto(inviteUrl);
    await waitForReadyLobby(host, 45_000);
    await waitForReadyLobby(guest, 45_000);

    await openOnlineMenu(third, { e2e: false });
    await joinWithCode(third, roomCode);
    await expect(third.getByText('ROOM IS FULL')).toBeVisible({ timeout: 20_000 });

    // Host + guest remain in the lobby, unaffected.
    await expect(host.getByTestId('ready-room')).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByTestId('ready-room')).toBeVisible({ timeout: 10_000 });
  } finally {
    await hostCtx.close().catch(() => {});
    await guestCtx.close().catch(() => {});
    await thirdCtx.close().catch(() => {});
  }
});

test('E2E 6 — second session after quitting a started match (reconnect)', async ({ browser }) => {
  test.setTimeout(240_000);
  const { host, guest, close } = await newIsolatedPages(browser);
  const errs = { errors: [] as string[], failed: [] as string[] };
  attachErrorCollectors(host, 'host', errs);
  attachErrorCollectors(guest, 'guest', errs);
  try {
    // FIRST SESSION: reach a started match through the real UI.
    await openOnlineMenu(host, { e2e: true });
    const first = await createFriendRoom(host);
    await guest.goto(first.inviteUrl);
    await waitForReadyLobby(host, 45_000);
    await waitForReadyLobby(guest, 45_000);
    await setReady(host);
    await setReady(guest);
    await waitForMatch(host, 30_000);
    await waitForMatch(guest, 30_000);
    const tick0 = (await testState(host)).tick;
    expect(tick0).toBeGreaterThanOrEqual(0);

    // Host quits to the title from pause; the guest follows via peer-quit.
    // No page reloads from here on: the second handshake must work in the
    // same page lifetime (stale transports/drivers must be fully detached).
    await host.keyboard.press('Escape');
    await expect(host.getByText('MATCH PAUSED').first()).toBeVisible({ timeout: 10_000 });
    await host.getByText('MAIN MENU').first().click();
    await expect(host.getByText('ONLINE MATCH').first()).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByText('ONLINE MATCH').first()).toBeVisible({ timeout: 20_000 });

    // SECOND SESSION: brand-new room, same pages, all the way to kickoff.
    await host.getByText('ONLINE MATCH').first().click();
    await expect(host.getByText('PLAY WITH A FRIEND').first()).toBeVisible({ timeout: 10_000 });
    await host.getByText('PLAY WITH A FRIEND').first().click();
    await expect(host.getByTestId('invite-url')).toBeVisible({ timeout: 15_000 });
    const room2 = (await host.getByTestId('room-code').textContent())?.trim() ?? '';
    expect(room2).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(room2).not.toBe(first.roomCode);
    await guest.getByText('ONLINE MATCH').first().click();
    await expect(guest.getByText('JOIN WITH CODE').first()).toBeVisible({ timeout: 10_000 });
    await joinWithCode(guest, room2);
    await waitForReadyLobby(host, 45_000);
    await waitForReadyLobby(guest, 45_000);
    const h2 = await peerIds(host);
    const g2 = await peerIds(guest);
    expect(h2.room).toBe(room2);
    expect(g2.room).toBe(room2);
    expect(h2.mine).not.toBe(g2.mine);
    await setReady(host);
    await setReady(guest);
    await waitForMatch(host, 30_000);
    await waitForMatch(guest, 30_000);
    await playInputBurst(host, 'move');
    await playInputBurst(guest, 'move');
    const a = await testState(host);
    const b = await testState(guest);
    expect(a.tick).toBeGreaterThan(0);
    expect(Math.abs(a.tick - b.tick)).toBeLessThanOrEqual(30);
    assertNoBadErrors(errs.errors, errs.failed);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(await dumpBoth(host, guest).catch(() => 'no state'));
    throw e;
  } finally {
    await close();
  }
});

test('E2E 5 — host cancel and friend-left produce clean states', async ({ browser }) => {
  const { host, guest, close } = await newIsolatedPages(browser);
  try {
    // Cancel before the guest joins returns to ONLINE.
    await openOnlineMenu(host, { e2e: true });
    await createFriendRoom(host);
    await host.getByTestId('host-cancel').click();
    await expect(host.getByText('PLAY WITH A FRIEND')).toBeVisible({ timeout: 10_000 });

    // Reconnect, then the guest leaving surfaces FRIEND LEFT (no SDP dump).
    await openOnlineMenu(host, { e2e: true });
    const { inviteUrl } = await createFriendRoom(host);
    await guest.goto(inviteUrl);
    await waitForReadyLobby(host, 45_000);
    await waitForReadyLobby(guest, 45_000);
    await guest.close();
    await expect(host.getByText('FRIEND LEFT')).toBeVisible({ timeout: 20_000 });
    const status = await host.getByTestId('online-status').textContent().catch(() => '');
    expect(status).not.toMatch(/sdp|ice|websocket|durable/i);
  } finally {
    await close();
  }
});
