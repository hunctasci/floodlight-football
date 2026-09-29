/**
 * Audio mastering pass on a rendered MP4: measure true peak (loudnorm
 * analysis) and apply a single attenuation so the mix peaks at ≤ -1 dBTP.
 * Gain only — no compression — so comedic silences and hits keep their
 * dynamics. Video is stream-copied. (The bundled ffmpeg has no limiter.)
 */
import { renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { REELS_ROOT } from './remotion';

const ff = (args: string[]) => spawnSync('npx', ['remotion', 'ffmpeg', '-hide_banner', ...args], { cwd: REELS_ROOT, encoding: 'utf8' });

export function measure(file: string): { lufs: number; truePeak: number } {
  const r = ff(['-i', file, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const json = /\{[\s\S]*?"input_i"[\s\S]*?\}/.exec(r.stderr ?? '');
  if (!json) throw new Error(`loudness analysis failed for ${file}`);
  const d = JSON.parse(json[0]) as { input_i: string; input_tp: string };
  return { lufs: Number(d.input_i), truePeak: Number(d.input_tp) };
}

export function master(file: string, ceiling = -1): { lufs: number; truePeak: number; gainDb: number } {
  const m = measure(file);
  const gainDb = Math.min(0, ceiling - m.truePeak);
  if (gainDb < -0.05) {
    const tmp = file.replace(/\.mp4$/, '.master.mp4');
    const r = ff(['-y', '-loglevel', 'error', '-i', file, '-c:v', 'copy', '-af', `volume=${gainDb.toFixed(2)}dB`, '-c:a', 'aac', '-b:a', '320k', tmp]);
    if (r.status !== 0) throw new Error(`mastering failed: ${r.stderr}`);
    renameSync(tmp, file);
  }
  return { ...m, gainDb };
}
