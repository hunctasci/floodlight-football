import { ChildProcess, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, chromium, Page } from '@playwright/test';
import type { CompiledSocialVideo } from '../timeline';
import type { CompiledTemplate } from '../templates/types';
import type { CompiledTrailer } from '../trailers/types';
import { pngDimensions } from './png';

const PACKAGE_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

/** Shape of the in-page harness API (mirrors harness-page.ts). */
interface HarnessApi {
  ready: boolean;
  renderFrame: (frame: number) => Promise<void>;
}

declare global {
  interface Window {
    __HNC_SOCIAL__?: HarnessApi;
    __HNC_SOCIAL_ERROR__?: string;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) { resolve(); return; }
      } catch { /* server not up yet */ }
      if (Date.now() - start > timeoutMs) { reject(new Error(`Harness server did not start: ${url}`)); return; }
      setTimeout(() => void attempt(), 150);
    };
    void attempt();
  });
}

async function startHarnessServer(port: number): Promise<ChildProcess> {
  const viteBin = path.join(PACKAGE_ROOT, '..', '..', 'node_modules', '.bin', 'vite');
  const child = spawn(viteBin, ['--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: PACKAGE_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr?.on('data', () => { /* harness noise stays out of CLI output */ });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/render.html`, 45_000);
  } catch (error) {
    child.kill('SIGTERM');
    throw error;
  }
  return child;
}

/**
 * Reused browser session for deterministic frame rendering: one Vite server,
 * one Chromium, one page. Every frame is evaluated random-access in the page
 * (`time = frame / fps`); page lifetime never advances the scene.
 */
export class SocialRenderSession {
  private constructor(
    private readonly dims: { width: number; height: number },
    private readonly server: ChildProcess,
    private readonly browser: Browser,
    private readonly page: Page,
  ) {}

  static async open(compiled: CompiledSocialVideo): Promise<SocialRenderSession> {
    const params = new URLSearchParams({
      scene: compiled.scene, home: compiled.home, away: compiled.away,
      format: compiled.format, seed: String(compiled.seed),
      fps: String(compiled.fps), duration: String(compiled.duration),
      attackTeam: compiled.attackTeam, attackStyle: compiled.attackStyle,
      overlays: compiled.overlaysMode,
    });
    // Semantic copy travels URL-encoded (spaces/Unicode/emoji safe).
    if (compiled.headline !== undefined) params.set('headline', compiled.headline);
    if (compiled.secondary !== undefined) params.set('secondary', compiled.secondary);
    if (compiled.cta !== undefined) params.set('cta', compiled.cta);
    return SocialRenderSession.openWithParams({ width: compiled.width, height: compiled.height }, params);
  }

  static async openTemplate(tpl: CompiledTemplate): Promise<SocialRenderSession> {
    const params = new URLSearchParams({
      template: tpl.template, home: tpl.home, away: tpl.away,
      format: tpl.format, seed: String(tpl.seed),
      fps: String(tpl.fps),
      attackTeam: tpl.attackTeam, attackStyle: tpl.attackStyle,
      overlays: tpl.overlaysMode,
    });
    if (tpl.headline !== undefined) params.set('headline', tpl.headline);
    if (tpl.secondary !== undefined) params.set('secondary', tpl.secondary);
    if (tpl.cta !== undefined) params.set('cta', tpl.cta);
    return SocialRenderSession.openWithParams({ width: tpl.width, height: tpl.height }, params);
  }

  static async openTrailer(tpl: CompiledTrailer): Promise<SocialRenderSession> {
    const params = new URLSearchParams({
      trailer: tpl.trailer, countries: tpl.countries.join(','),
      format: tpl.format, seed: String(tpl.seed),
      fps: String(tpl.fps),
      attackTeam: tpl.attackTeam, attackStyle: tpl.attackStyle,
      overlays: tpl.overlaysMode,
    });
    return SocialRenderSession.openWithParams({ width: tpl.width, height: tpl.height }, params);
  }

  private static async openWithParams(
    dims: { width: number; height: number },
    params: URLSearchParams,
  ): Promise<SocialRenderSession> {
    const port = await freePort();
    const server = await startHarnessServer(port);
    try {
      const browser = await chromium.launch({
        args: [
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--enable-unsafe-swiftshader',
        ],
      });
      try {
        const page = await browser.newPage({
          viewport: { width: dims.width, height: dims.height },
          deviceScaleFactor: 1,
        });
        await page.goto(`http://127.0.0.1:${port}/render.html?${params.toString()}`, { waitUntil: 'load' });
        await page.waitForFunction(
          () => window.__HNC_SOCIAL__?.ready === true || typeof window.__HNC_SOCIAL_ERROR__ === 'string',
          null,
          { timeout: 60_000 },
        );
        const harnessError = await page.evaluate(() => window.__HNC_SOCIAL_ERROR__);
        if (typeof harnessError === 'string') throw new Error(`Social harness failed: ${harnessError}`);
        return new SocialRenderSession(dims, server, browser, page);
      } catch (error) {
        await browser.close();
        throw error;
      }
    } catch (error) {
      server.kill('SIGTERM');
      throw error;
    }
  }

  /** Render one timeline frame in the page; resolves once presented. */
  async renderFrame(frame: number): Promise<void> {
    try {
      await this.page.evaluate((f) => window.__HNC_SOCIAL__!.renderFrame(f), frame);
    } catch (error) {
      throw new Error(`Frame ${frame} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Render one frame and screenshot it to an exact-size PNG. */
  async screenshotFrame(frame: number, output: string): Promise<{ output: string; width: number; height: number }> {
    await mkdir(path.dirname(output), { recursive: true });
    await this.renderFrame(frame);
    await this.page.screenshot({ path: output });
    const dims = pngDimensions(await readFile(output));
    if (dims.width !== this.dims.width || dims.height !== this.dims.height) {
      throw new Error(`Screenshot is ${dims.width}x${dims.height}, expected ${this.dims.width}x${this.dims.height}`);
    }
    return { output, ...dims };
  }

  async close(): Promise<void> {
    try {
      await this.browser.close();
    } finally {
      this.server.kill('SIGTERM');
    }
  }
}
