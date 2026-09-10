import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveFfmpeg, resolveFfprobe } from './ffmpeg';

const execFileAsync = promisify(execFile);

export interface ProbedMedia {
  codecVideo: string;
  codecAudio: string | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  pixFmt: string | null;
  hasFaststart: boolean | null;
}

export class ProbeError extends Error {}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  pix_fmt?: string;
}

interface FfprobeFormat {
  duration?: string;
}

function parseFps(rate: string | undefined): number {
  if (!rate) return NaN;
  const [n, d] = rate.split('/').map(Number);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  if (!d || d === 0) return n;
  return n / d;
}

/** Probe with ffprobe (JSON): codec, size, fps, duration, pixel format. */
export async function probeMedia(ffprobe: string, file: string): Promise<ProbedMedia> {
  let raw: string;
  try {
    const { stdout } = await execFileAsync(ffprobe, [
      '-v', 'error',
      '-show_streams', '-show_format',
      '-of', 'json',
      file,
    ]);
    raw = stdout;
  } catch (error) {
    throw new ProbeError(`ffprobe failed for ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  let parsed: { streams?: FfprobeStream[]; format?: FfprobeFormat };
  try {
    parsed = JSON.parse(raw) as { streams?: FfprobeStream[]; format?: FfprobeFormat };
  } catch {
    throw new ProbeError(`ffprobe returned invalid JSON for ${file}`);
  }
  const video = (parsed.streams ?? []).find((s) => s.codec_type === 'video');
  const audio = (parsed.streams ?? []).find((s) => s.codec_type === 'audio');
  if (!video) throw new ProbeError(`no video stream in ${file}`);
  return {
    codecVideo: video.codec_name ?? 'unknown',
    codecAudio: audio?.codec_name ?? null,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: parseFps(video.avg_frame_rate),
    duration: Number(parsed.format?.duration ?? NaN),
    pixFmt: video.pix_fmt ?? null,
    hasFaststart: null, // detected separately from the moov atom position.
  };
}

/**
 * Check `moov before mdat` (faststart) by scanning top-level MP4 boxes.
 * Pure local parse — no subprocess.
 */
export async function hasFaststart(file: string): Promise<boolean> {
  const { open } = await import('node:fs/promises');
  const handle = await open(file, 'r');
  try {
    const head = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    let moovAt = -1;
    let mdatAt = -1;
    let off = 0;
    while (off + 8 <= bytesRead) {
      const size = head.readUInt32BE(off);
      const type = head.toString('latin1', off + 4, off + 8);
      if (type === 'moov' && moovAt < 0) moovAt = off;
      if (type === 'mdat' && mdatAt < 0) mdatAt = off;
      if (size < 8) break;
      off += size;
      if (moovAt >= 0 && mdatAt >= 0) break;
    }
    return moovAt >= 0 && (mdatAt < 0 || moovAt < mdatAt);
  } finally {
    await handle.close();
  }
}

export interface ExpectedMedia {
  width: number;
  height: number;
  fps: number;
  duration: number;
  durationTolerance?: number;
}

/** Validate probed media against the compiled spec. Throws ProbeError. */
export function validateMedia(probed: ProbedMedia, expected: ExpectedMedia): void {
  const tolerance = expected.durationTolerance ?? 0.15;
  const failures: string[] = [];
  if (probed.codecVideo !== 'h264') failures.push(`codec is ${probed.codecVideo}, expected h264`);
  if (probed.codecAudio !== 'aac') failures.push(`audio codec is ${probed.codecAudio ?? 'missing'}, expected aac`);
  if (probed.width !== expected.width || probed.height !== expected.height) {
    failures.push(`size is ${probed.width}x${probed.height}, expected ${expected.width}x${expected.height}`);
  }
  if (!Number.isFinite(probed.fps) || Math.abs(probed.fps - expected.fps) > 0.5) {
    failures.push(`fps is ${probed.fps}, expected ${expected.fps}`);
  }
  if (!Number.isFinite(probed.duration) || Math.abs(probed.duration - expected.duration) > tolerance) {
    failures.push(`duration is ${probed.duration}s, expected ${expected.duration}s`);
  }
  if (probed.pixFmt !== null && probed.pixFmt !== 'yuv420p') {
    failures.push(`pixel format is ${probed.pixFmt}, expected yuv420p`);
  }
  if (failures.length > 0) throw new ProbeError(`Output validation failed:\n- ${failures.join('\n- ')}`);
}

export { resolveFfmpeg, resolveFfprobe };
