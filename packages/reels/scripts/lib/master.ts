/**
 * Audio mastering pass on a rendered MP4: measure (EBU R128 via loudnorm's
 * analysis) and apply ONE static gain toward social loudness (-14 LUFS
 * integrated) capped by a -1.5 dBTP ceiling. Static gain keeps comedic
 * silences and pre-impact hushes exactly as mixed; a peaky mix lands slightly
 * under target (reported) rather than being compressed. Video is stream-copied.
 */
import { renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { REELS_ROOT } from './remotion';

const ff = (args: string[]) => spawnSync('npx', ['remotion', 'ffmpeg', '-hide_banner', ...args], { cwd: REELS_ROOT, encoding: 'utf8' });

export const LOUDNESS = { target: -14, truePeak: -1.5, lra: 11 } as const;

interface Measured {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

function analyse(file: string, filter = 'loudnorm=print_format=json'): Measured {
  const r = ff(['-i', file, '-vn', '-af', filter, '-f', 'null', '-']);
  const json = /\{[\s\S]*?"input_i"[\s\S]*?\}/.exec(r.stderr ?? '');
  if (!json) throw new Error(`loudness analysis failed for ${file}`);
  return JSON.parse(json[0]) as Measured;
}

export function measure(file: string): { lufs: number; truePeak: number } {
  const d = analyse(file);
  return { lufs: Number(d.input_i), truePeak: Number(d.input_tp) };
}

export function master(file: string): { lufs: number; truePeak: number; gainDb: number; out: { lufs: number; truePeak: number } } {
  const { target, truePeak } = LOUDNESS;
  const m = analyse(file);
  const lufs = Number(m.input_i);
  const tp = Number(m.input_tp);
  // One static gain: reach the target unless the true peak would pass the
  // ceiling first (no limiter in the bundled ffmpeg; loudnorm's dynamic mode
  // pumps comedic silences, so it is never used).
  const gainDb = Math.min(target - lufs, truePeak - tp);
  if (Math.abs(gainDb) > 0.05) {
    const tmp = file.replace(/\.mp4$/, '.master.mp4');
    const r = ff(['-y', '-loglevel', 'error', '-i', file, '-c:v', 'copy', '-af', `volume=${gainDb.toFixed(2)}dB`, '-c:a', 'aac', '-b:a', '320k', tmp]);
    if (r.status !== 0) throw new Error(`mastering failed: ${r.stderr}`);
    renameSync(tmp, file);
  }
  return { lufs, truePeak: tp, gainDb, out: measure(file) };
}
