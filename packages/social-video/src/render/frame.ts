import { ChildProcess, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import type { ResolvedFrameSpec } from '../schema';

export interface RenderedFrame {
  output: string;
  width: number;
  height: number;
}

const PACKAGE_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

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

/** Minimal PNG probe: reads width/height from the IHDR chunk, no decoding. */
export function pngDimensions(buf: Buffer): { width: number; height: number } {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error('Output is not a valid PNG');
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Render one deterministic social frame with the real HNC renderer:
 * local harness -> headless Chromium (SwiftShader WebGL) -> exact-viewport
 * PNG screenshot. Readiness comes from the page's explicit
 * `window.__HNC_SOCIAL_READY__` flag — never an arbitrary sleep.
 */
export async function renderFrameToPng(spec: ResolvedFrameSpec, output: string): Promise<RenderedFrame> {
  await mkdir(path.dirname(output), { recursive: true });
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
        viewport: { width: spec.width, height: spec.height },
        deviceScaleFactor: 1,
      });
      const params = new URLSearchParams({
        scene: spec.scene, home: spec.home, away: spec.away,
        format: spec.format, seed: String(spec.seed),
      });
      await page.goto(`http://127.0.0.1:${port}/render.html?${params.toString()}`, { waitUntil: 'load' });
      await page.waitForFunction(
        () => window.__HNC_SOCIAL_READY__ === true || typeof window.__HNC_SOCIAL_ERROR__ === 'string',
        null,
        { timeout: 60_000 },
      );
      const harnessError = await page.evaluate(() => window.__HNC_SOCIAL_ERROR__);
      if (typeof harnessError === 'string') throw new Error(`Social harness failed: ${harnessError}`);
      await page.screenshot({ path: output });
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }
  const dims = pngDimensions(await readFile(output));
  if (dims.width !== spec.width || dims.height !== spec.height) {
    throw new Error(`Screenshot is ${dims.width}x${dims.height}, expected ${spec.width}x${spec.height}`);
  }
  return { output, ...dims };
}
