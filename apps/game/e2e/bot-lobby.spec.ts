import { test, expect } from '@playwright/test';

test('country fallback starts a match and friend invites open directly', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.goto('/');
  await page.getByTestId('consent-decline').click();
  await page.getByTestId('onboard-name').fill('Country Tester');
  await page.getByTestId('onboard-country').selectOption('TR');
  await page.getByTestId('onboard-continue').click();
  await expect(page.getByText('Computer-controlled opponents may fill empty slots.', { exact: false })).toBeVisible();
  await page.screenshot({ path: '/tmp/hnc-friend-lobby.png' });
  await page.getByTestId('challenge-friend').click();
  await expect(page.getByTestId('invite-url')).toBeVisible();
  await expect(page.getByText('SHARE INVITE LINK →', { exact: true })).toBeVisible();
  await page.getByTestId('host-cancel').click();
  // Cancel returns to the friend menu; Escape returns to the country lobby.
  if (!(await page.getByTestId('find-match').isVisible())) await page.keyboard.press('Escape');
  const assignment = page.waitForResponse(async r => r.url().includes('/api/matchmaking/poll') && (await r.json()).kind === 'bot', { timeout: 30000 });
  await page.getByTestId('find-match').click();
  const { bot } = await (await assignment).json();
  expect(bot.homeCountry).toBe('TR');
  expect(bot.opponentCountry).not.toBe('TR');
  await expect.poll(async () => JSON.parse(await page.locator('body').getAttribute('data-match') ?? '{}').screen).toBe('match');
  const forbidden = await page.request.post(`/api/matches/${bot.matchId}/result`, { data: { clientId: bot.homeClientId, matchToken: bot.matchToken, homeScore: 99, awayScore: 0 } });
  expect(forbidden.status()).toBe(403);
  await page.screenshot({ path: '/tmp/hnc-bot-game.png' });
});

test('full-time country result offers native sharing and scorecard download', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.addInitScript(() => {
    localStorage.setItem('floodlight-consent', 'denied');
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: unknown) => { (window as any).sharedResult = data; } });
  });
  // Short assignment isolates the sharing UI; server replay validation is tested separately.
  await page.route('**/api/matchmaking/join', async route => {
    const { clientId } = route.request().postDataJSON();
    await route.fulfill({ json: { status: 'matched', kind: 'bot', bot: {
      matchId: '11111111-1111-4111-8111-111111111111', matchToken: 'test-token', homeClientId: clientId,
      awayClientId: 'test-away', homeCountry: 'TR', opponentCountry: 'BR', opponentName: 'Alex', seed: 123,
      halfDuration: 2, difficulty: 0,
    } } });
  });
  await page.route('**/api/bot-matches/*/result', route => route.fulfill({ json: { status: 'confirmed' } }));
  await page.goto('/');
  await page.getByTestId('onboard-name').fill('Share Tester');
  await page.getByTestId('onboard-country').selectOption('TR');
  await page.getByTestId('onboard-continue').click();
  await page.getByTestId('find-match').click();
  await expect(page.getByTestId('share-result')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('share-result').click();
  const shared = await page.evaluate(() => (window as any).sharedResult);
  expect(shared.text).toContain('Türkiye');
  expect(shared.text).toContain('Brazil');
  expect(shared.url).toMatch(/^http:\/\/127.0.0.1:5197\/$/);
  const download = page.waitForEvent('download');
  await page.getByText('SAVE / SHARE SCORECARD', { exact: true }).click();
  expect((await download).suggestedFilename()).toBe('hnc-league-result.png');
  await page.screenshot({ path: '/tmp/hnc-result-sharing.png' });
});
