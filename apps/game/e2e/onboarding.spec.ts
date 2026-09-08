import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
  test(`name survives country selection, validation and reload (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const name = page.getByTestId('onboard-name');
    const country = page.getByTestId('onboard-country');
    await name.pressSequentially('Hunc Wasim', { delay: 40 });
    await country.selectOption('BR');
    await expect(name).toHaveValue('Hunc Wasim');
    await country.selectOption('DE');
    await expect(name).toHaveValue('Hunc Wasim');
    await name.fill('');
    await page.getByTestId('onboard-continue').click();
    await expect(page.getByTestId('onboard-msg')).toContainText('NAME MUST BE');
    await expect(name).toHaveValue('');
    await expect(country).toHaveValue('DE');
    await name.fill('Hunc Wasim');
    const saved = page.waitForResponse(r => r.url().endsWith('/api/profile') && r.request().method() === 'POST');
    await page.getByTestId('onboard-continue').click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText('ONLINE MATCH', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('ONLINE MATCH', { exact: true })).toBeVisible();
    await expect(page.getByText('HUNC WASIM · GERMANY')).toBeVisible();
  });
}

test('Enter submits a name without inserting a newline', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('onboard-name').fill('Keyboard');
  await page.getByTestId('onboard-name').press('Enter');
  await expect(page.getByText('ONLINE MATCH', { exact: true })).toBeVisible();
});

test('D1 confirms matching country results and awards league points', async ({ request }) => {
  const home = crypto.randomUUID(), away = crypto.randomUUID();
  for (const [clientId, cityCode] of [[home, 'TR'], [away, 'BR']]) {
    const response = await request.post('/api/profile', { data: { clientId, displayName: 'League Test', cityCode } });
    expect(response.status()).toBe(200);
  }
  const before = await (await request.get('/api/country-league')).json();
  const pointsBefore = before.standings.find((r: { cityCode: string }) => r.cityCode === 'TR').points;
  const created = await request.post('/api/country-league/matches', { data: {
    roomCode: 'ABCDEF', homeClientId: home, awayClientId: away, homeCityCode: 'TR', awayCityCode: 'BR',
  } });
  expect(created.ok()).toBeTruthy();
  const { matchId, matchToken } = await created.json();
  for (const [clientId, status] of [[home, 'pending'], [away, 'confirmed']]) {
    const result = await request.post(`/api/matches/${matchId}/result`, { data: { clientId, matchToken, homeScore: 2, awayScore: 1 } });
    expect((await result.json()).status).toBe(status);
  }
  const after = await (await request.get('/api/country-league')).json();
  expect(after.standings).toHaveLength(249);
  expect(after.standings.find((r: { cityCode: string }) => r.cityCode === 'TR').points).toBe(pointsBefore + 3);
});
