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
