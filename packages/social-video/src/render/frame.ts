import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { compileVideo, frameFilename } from '../timeline';
import type { CompiledTemplate } from '../templates/types';
import type { ResolvedVideoSpec } from '../schema';
import { SocialRenderSession } from './session';

export interface RenderedFrame {
  output: string;
  width: number;
  height: number;
}

export interface SequenceProgress {
  frame: number;
  totalFrames: number;
  path: string;
}

export interface RenderedSequence {
  dir: string;
  totalFrames: number;
  width: number;
  height: number;
}

/**
 * Render one deterministic timeline frame with the real HNC renderer:
 * local harness -> headless Chromium (SwiftShader WebGL) -> exact-viewport
 * PNG screenshot. The frame is evaluated random-access (`time = frame /
 * fps`); readiness comes from the page's per-frame render promise — never
 * an arbitrary sleep.
 */
export async function renderFrameToPng(
  video: ResolvedVideoSpec,
  output: string,
  frame = 0,
): Promise<RenderedFrame> {
  const compiled = compileVideo(video);
  const session = await SocialRenderSession.open(compiled);
  try {
    return await session.screenshotFrame(frame, output);
  } finally {
    await session.close();
  }
}

/**
 * Remove only previously generated frame files (`NNNNNN.png`) from a sequence
 * directory. Anything else in the directory is left untouched, so a stale
 * longer render can never mix with a new shorter one, and user files are
 * never wiped.
 */
export async function clearFramePngs(dir: string): Promise<number> {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }
  const stale = entries.filter((e) => /^\d{6}\.png$/.test(e));
  await Promise.all(stale.map((e) => rm(path.join(dir, e), { force: true })));
  return stale.length;
}

/**
 * Render a full deterministic PNG sequence through ONE reused browser
 * session (one Vite server, one Chromium, one page, one renderer). Frames
 * are named 000000.png ... NNNNNN.png.
 */
export async function renderFramesToDir(
  video: ResolvedVideoSpec,
  dir: string,
  onProgress?: (p: SequenceProgress) => void,
): Promise<RenderedSequence> {
  await mkdir(dir, { recursive: true });
  await clearFramePngs(dir);
  const compiled = compileVideo(video);
  const session = await SocialRenderSession.open(compiled);
  try {
    for (let frame = 0; frame < compiled.totalFrames; frame++) {
      const out = path.join(dir, frameFilename(frame));
      await session.screenshotFrame(frame, out);
      onProgress?.({ frame, totalFrames: compiled.totalFrames, path: out });
    }
  } finally {
    await session.close();
  }
  return { dir, totalFrames: compiled.totalFrames, width: compiled.width, height: compiled.height };
}

/**
 * Render one deterministic template frame (global timeline position) with
 * the real HNC renderer. Same random-access contract as renderFrameToPng.
 */
export async function renderTemplateFrameToPng(
  tpl: CompiledTemplate,
  output: string,
  frame = 0,
): Promise<RenderedFrame> {
  const session = await SocialRenderSession.openTemplate(tpl);
  try {
    return await session.screenshotFrame(frame, output);
  } finally {
    await session.close();
  }
}

/**
 * Render a full template PNG sequence through ONE reused browser session.
 * Frames are named 000000.png ... NNNNNN.png (global template frames).
 */
export async function renderTemplateFramesToDir(
  tpl: CompiledTemplate,
  dir: string,
  onProgress?: (p: SequenceProgress) => void,
): Promise<RenderedSequence> {
  await mkdir(dir, { recursive: true });
  await clearFramePngs(dir);
  const session = await SocialRenderSession.openTemplate(tpl);
  try {
    for (let frame = 0; frame < tpl.totalFrames; frame++) {
      const out = path.join(dir, frameFilename(frame));
      await session.screenshotFrame(frame, out);
      onProgress?.({ frame, totalFrames: tpl.totalFrames, path: out });
    }
  } finally {
    await session.close();
  }
  return { dir, totalFrames: tpl.totalFrames, width: tpl.width, height: tpl.height };
}
