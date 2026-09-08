import { test, expect } from '@playwright/test';

async function joinQueue(request: any, country: string) {
  const clientId = crypto.randomUUID(), peerId = crypto.randomUUID();
  expect((await request.post('/api/profile', { data: { clientId, displayName: 'Queue Test', cityCode: country } })).ok()).toBeTruthy();
  const response = await request.post('/api/matchmaking/join', { data: { clientId, peerId } });
  expect(response.ok()).toBeTruthy();
  return { ...(await response.json()), clientId, peerId };
}
test('queue pairs different countries once, authenticates polls, and cancels both sides', async ({ request }) => {
  const a = await joinQueue(request, 'TR');
  const b = await joinQueue(request, 'TR');
  expect(a.status).toBe('queued'); expect(b.status).toBe('queued');
  const c = await joinQueue(request, 'BR');
  expect(c.status).toBe('matched'); expect(c.role).toBe('guest');
  const poll = async (ticket: string) => (await request.post('/api/matchmaking/poll', { data: { ticket } })).json();
  const host = await poll(a.ticket);
  expect(host.status).toBe('matched'); expect(host.roomCode).toBe(c.roomCode);
  expect((await poll(b.ticket)).status).toBe('queued');
  expect((await request.post('/api/matchmaking/poll', { data: { ticket: 'wrong' } })).status()).toBe(400);
  await request.post('/api/matchmaking/cancel', { data: { ticket: c.ticket } });
  expect((await poll(a.ticket)).status).toBe('cancelled');
  await request.post('/api/matchmaking/cancel', { data: { ticket: b.ticket } });
});

test('two country players find each other and start a national-team match', async ({ browser }) => {
  test.setTimeout(240000);
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 640, height: 480 } }), browser.newContext({ viewport: { width: 640, height: 480 } })]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  try {
    for (let i = 0; i < 2; i++) {
      const page = pages[i];
      await page.goto('/');
      await page.getByTestId('onboard-name').fill(i === 0 ? 'Turkey Player' : 'Brazil Player');
      await page.getByTestId('onboard-country').selectOption(i === 0 ? 'TR' : 'BR');
      await page.getByTestId('onboard-continue').click();
      const consent = page.getByTestId('consent-decline');
      if (await consent.isVisible()) await consent.click();
      await expect(page.getByTestId('find-match')).toBeVisible();
      await page.goto('/?e2e=1');
      await expect(page.getByTestId('find-match')).toBeVisible();
    }
    await pages[0].getByTestId('find-match').click();
    await expect(pages[0].getByTestId('cancel-search')).toBeVisible();
    await pages[1].getByTestId('find-match').click();
    for (const page of pages) {
      await expect.poll(() => page.evaluate(() => (window as any).__floodlightTest.getScreen()), { timeout: 60000 }).toBe('match');
      const teams = await page.evaluate(() => (window as any).__retro.engine.state.teams);
      expect(teams.map((t: any) => t.short)).toEqual(['TR', 'BR']);
      expect(teams[0].color).toBe('#e30a17'); expect(teams[1].color).toBe('#ffdf00');
    }
    await pages[0].screenshot({ path: '/tmp/hnc-country-match.png' });
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      const states = await Promise.all(pages.map(p => p.evaluate(() => (window as any).__floodlightTest.getScreen())));
      if (states.every(s => s === 'full')) break;
      for (let i = 0; i < pages.length; i++) if (states[i] === 'match') await pages[i].keyboard.press('s');
      await pages[0].waitForTimeout(1200);
    }
    for (const page of pages) {
      await expect(page.getByTestId('fulltime-title')).toBeVisible();
      await expect(page.getByTestId('city-status')).toContainText('RESULT CONFIRMED', { timeout: 25000 });
      const state = await page.evaluate(() => (window as any).__floodlightTest.getSimulationState());
      expect(state.half).toBe(2); expect(state.tick).toBeGreaterThan(500);
    }
  } catch (error) {
    for (const page of pages) console.log(await page.evaluate(() => ({ state: (window as any).__floodlightTest.getSimulationState(), log: (window as any).__floodlightTest.getNetLog() })).catch(() => 'Page closed'));
    throw error;
  } finally { await Promise.all(contexts.map(c => c.close().catch(() => {}))); }
});

test('D1 resolves simultaneous score reports once and rejects a forged country', async ({ request }) => {
  const home = crypto.randomUUID(), away = crypto.randomUUID();
  for (const [clientId, cityCode] of [[home,'TR'],[away,'BR']]) await request.post('/api/profile', { data: { clientId, displayName:'Score Test', cityCode } });
  const data = { roomCode:'ABCDEF', homeClientId:home, awayClientId:away, homeCityCode:'TR', awayCityCode:'BR' };
  expect((await request.post('/api/country-league/matches', {data:{...data, homeCityCode:'DE'}})).status()).toBe(403);
  const { matchId, matchToken } = await (await request.post('/api/country-league/matches', {data})).json();
  const submit = (clientId: string) => request.post(`/api/matches/${matchId}/result`, {data:{clientId,matchToken,homeScore:2,awayScore:1}});
  await Promise.all([submit(home),submit(away)]);
  expect((await (await submit(home)).json()).status).toBe('confirmed');
  expect((await (await submit(away)).json()).status).toBe('confirmed');
  const bad = await request.post(`/api/matches/${matchId}/result`, {data:{clientId:home,matchToken:'0'.repeat(64),homeScore:2,awayScore:1}});
  expect(bad.status()).toBe(403);
});
