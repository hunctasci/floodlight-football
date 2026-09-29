/**
 * Node-side Remotion helpers shared by the render / still / QA scripts:
 * bundle once, then render any number of stills or one video from it.
 * `gl: 'swangle'` mirrors remotion.config.ts (CLI config is not read by the
 * programmatic API).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';

export const REELS_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const CHROMIUM = { gl: 'swangle' as const };
const quiet = (): void => undefined;

let bundled: Promise<string> | undefined;

export function bundleReels(): Promise<string> {
  bundled ??= bundle({ entryPoint: path.join(REELS_ROOT, 'src/entry.tsx'), publicDir: path.join(REELS_ROOT, 'public') });
  return bundled;
}

export async function stills(
  compositionId: string,
  inputProps: Record<string, unknown>,
  frames: readonly number[],
  outFile: (frame: number) => string,
): Promise<string[]> {
  const serveUrl = await bundleReels();
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps, chromiumOptions: CHROMIUM, logLevel: 'error', onBrowserLog: quiet });
  const out: string[] = [];
  for (const frame of frames) {
    const output = outFile(frame);
    mkdirSync(path.dirname(output), { recursive: true });
    await renderStill({ serveUrl, composition, inputProps, frame, output, imageFormat: 'png', chromiumOptions: CHROMIUM, logLevel: 'error', onBrowserLog: quiet });
    out.push(output);
  }
  return out;
}

export async function video(
  compositionId: string,
  inputProps: Record<string, unknown>,
  output: string,
  opts: { scale?: number; frameRange?: [number, number] } = {},
): Promise<void> {
  const serveUrl = await bundleReels();
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps, chromiumOptions: CHROMIUM, logLevel: 'error', onBrowserLog: quiet });
  mkdirSync(path.dirname(output), { recursive: true });
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: 'h264',
    audioCodec: 'aac',
    outputLocation: output,
    chromiumOptions: CHROMIUM,
    scale: opts.scale ?? 1,
    frameRange: opts.frameRange ?? null,
    logLevel: 'error',
    onBrowserLog: quiet,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) {
        last = pct;
        process.stdout.write(`  ${pct}%`);
      }
    },
  });
  process.stdout.write('\n');
}

/**
 * Tile PNGs into one labeled contact sheet (sharp; Remotion's bundled ffmpeg
 * is a minimal build without tiling/text filters).
 */
export async function contactSheet(
  tiles: readonly { file: string; label: string }[],
  output: string,
  columns = 5,
  tileWidth = 216,
): Promise<void> {
  if (tiles.length === 0) return;
  const meta = await sharp(tiles[0].file).metadata();
  const tileHeight = Math.round((tileWidth * (meta.height ?? 1920)) / (meta.width ?? 1080));
  const gap = 4;
  const labelH = 22;
  const rows = Math.ceil(tiles.length / columns);
  const width = columns * (tileWidth + gap) + gap;
  const height = rows * (tileHeight + labelH + gap) + gap;
  const layers = await Promise.all(
    tiles.map(async (t, i) => {
      const left = gap + (i % columns) * (tileWidth + gap);
      const top = gap + Math.floor(i / columns) * (tileHeight + labelH + gap);
      // Letterbox, never crop: sheets mix 9:16 / 4:5 / 1:1 tiles.
      const img = await sharp(t.file).resize(tileWidth, tileHeight, { fit: 'contain', background: '#0b1526' }).png().toBuffer();
      const text = t.label.replace(/[<>&]/g, '');
      const svg = Buffer.from(`<svg width="${tileWidth}" height="${labelH}"><text x="4" y="16" font-family="Menlo, monospace" font-size="13" fill="#f8efdb">${text}</text></svg>`);
      return [
        { input: svg, left, top },
        { input: img, left, top: top + labelH },
      ];
    }),
  );
  mkdirSync(path.dirname(output), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: '#0b1526' } }).composite(layers.flat()).png().toFile(output);
}
