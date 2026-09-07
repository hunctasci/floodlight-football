import { defineConfig, devices } from '@playwright/test';

/**
 * Real-browser multiplayer E2E: drives the ACTUAL game UI in two isolated
 * browser contexts (independent storage/identity) against the real local
 * Cloudflare runtime (Vite plugin Worker + Durable Objects + room WebSocket)
 * and real browser WebRTC (no RTC fakes).
 *
 * webServer boots the same origin the player uses: frontend + control plane.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
