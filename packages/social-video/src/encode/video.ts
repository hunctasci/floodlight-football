import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Quality-oriented social-video encode: H.264 CRF 19 (visually near-lossless
 * for flat arcade art, far smaller than lossless), yuv420p for platform
 * players, AAC 192k audio, faststart for progressive web playback.
 */
export const VIDEO_CRF = 19;
export const VIDEO_PRESET = 'medium';
export const AUDIO_BITRATE = '192k';

export interface VideoEncodeInput {
  /** Frames per second from the compiled spec (never hardcoded). */
  fps: number;
  /** Absolute printf-style PNG pattern, e.g. /tmp/xyz/%06d.png. */
  framePattern: string;
  /** Absolute SFX WAV path (exactly video duration). */
  audioPath: string;
  /** Optional user music file (mixed underneath SFX, never mutated). */
  musicPath?: string;
  /** Music gain when supplied (default 0.25). */
  musicVolume?: number;
  /** Absolute output MP4 path. */
  output: string;
}

/**
 * Build the ffmpeg argument list (spawn form — never a shell string, so user
 * paths cannot inject commands). One invocation encodes + muxes: PNG
 * sequence + generated SFX bed (+ optional music ducked underneath).
 */
export function buildEncodeArgs(input: VideoEncodeInput): string[] {
  const musicVolume = input.musicVolume ?? 0.25;
  const args = [
    '-y',
    '-framerate', String(input.fps),
    '-i', input.framePattern,
    '-i', input.audioPath,
  ];
  if (input.musicPath) {
    args.push('-i', input.musicPath);
    args.push(
      '-filter_complex',
      `[2:a]aresample=48000,volume=${musicVolume},afade=t=in:st=0:d=0.5[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`,
      '-map', '0:v',
      '-map', '[a]',
    );
  } else {
    args.push('-map', '0:v', '-map', '1:a');
  }
  args.push(
    '-c:v', 'libx264',
    '-preset', VIDEO_PRESET,
    '-crf', String(VIDEO_CRF),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', AUDIO_BITRATE,
    '-movflags', '+faststart',
    '-shortest',
    input.output,
  );
  return args;
}

export interface SpawnResult {
  status: number | null;
  signal: string | null;
  stderr: string;
}

/** Run ffmpeg to completion, capturing stderr for diagnostics. */
export function runFfmpeg(ffmpeg: string, args: string[]): { child: ChildProcess; done: Promise<SpawnResult> } {
  const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const done = new Promise<SpawnResult>((resolve, reject) => {
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (status, signal) => resolve({ status, signal, stderr }));
  });
  return { child, done };
}
