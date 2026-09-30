#!/usr/bin/env tsx
/**
 * HNC Player Diaries — production pipeline (one command per stage).
 *
 *   npm run diaries -- voices                     dialogue takes (Kokoro, ASR-verified)
 *   npm run diaries -- plates --quality animatic  Blender shots -> PNG sequences (cached, parallel)
 *        [--only S01_SH02,S02_SH01] [--jobs 3] [--force]
 *   npm run diaries -- ui                         Remotion stills Blender needs (phone World Table)
 *   npm run diaries -- audio                      SFX + score + mix -> stems
 *   npm run diaries -- edit --quality animatic    Remotion assembly -> MP4
 *        [--out social/output/player-diaries/ep01-belgium/animatic-v1.mp4]
 *   npm run diaries -- master --in <mp4> --out <mp4>   loudness + codec verification (ffprobe)
 *   npm run diaries -- sheet --in <mp4> --out <png>    contact sheet (1 frame / second)
 *   npm run diaries -- storyboard                 storyboard.md from edit.json
 *
 * Cache: a plate is re-rendered only when its key changes —
 * sha256(shot description + its dialogue take lengths + hnc_blender sources +
 * canonical asset hashes + Blender version + quality).
 */
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBlender } from '../blender/src/paths.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EP = 'ep01';
const EDIT = path.join(REPO, 'packages/reels/src/diaries', EP, 'edit.json');
const DIALOGUE = path.join(REPO, 'packages/reels/src/diaries', EP, 'dialogue.json');
const GEN = path.join(REPO, 'packages/reels/public/generated/diaries', EP);
const OUT = path.join(REPO, 'social/output/player-diaries/ep01-belgium');
/** venv python on macOS/Linux (bin/python) or Windows (Scripts/python.exe). */
const venvPy = (dir: string): string => {
  const win = path.join(dir, '.venv', 'Scripts', 'python.exe');
  return process.platform === 'win32' && existsSync(win) ? win : path.join(dir, '.venv', 'bin', 'python');
};
const PY = process.env.HNC_DIARIES_PY ?? venvPy(path.join(REPO, '..', '.tools', 'tts'));
const CHATTERBOX_PY = process.env.HNC_CHATTERBOX_PY ?? venvPy(path.join(REPO, '..', '.tools', 'chatterbox'));
// Same discovery as blender:* (HNC_BLENDER_BIN → BLENDER_PATH → macOS app → `blender` on PATH).
const BLENDER = findBlender();

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string, dflt?: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name: string): boolean => args.includes(`--${name}`);
const sha = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

interface ShotSpec {
  id: string;
  dur: number;
  renderer: 'blender' | 'remotion' | 'hybrid';
  dialogue?: { line: string; at: number }[];
  [k: string]: unknown;
}

const edit = (): { fps: number; shots: ShotSpec[] } => JSON.parse(readFileSync(EDIT, 'utf8'));
const voices = (): Record<string, { seconds: number }> => {
  const p = path.join(GEN, 'vo', 'voices.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
};

function walk(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== '__pycache__') out.push(...walk(p, ext));
    } else if (p.endsWith(ext)) out.push(p);
  }
  return out.sort();
}

function sourcesHash(): string {
  const files = walk(path.join(REPO, 'tools/blender/py/hnc_blender'), '.py');
  const manifest = JSON.parse(readFileSync(path.join(REPO, 'social/blender/generated/manifest.json'), 'utf8'));
  const assets = manifest.assets.map((a: { assetId: string; sha256: string }) => `${a.assetId}:${a.sha256}`).join(',');
  return sha(files.map((f) => sha(readFileSync(f))).join('') + assets);
}

/** Remotion stills that Blender maps into hybrid shots are inputs of those shots only. */
function uiHash(): string {
  const ui = path.join(GEN, 'ui');
  return existsSync(ui) ? sha(walk(ui, '.png').map((f) => sha(readFileSync(f))).join('')) : '';
}

function blenderVersion(): string {
  return execFileSync(BLENDER, ['--version'], { encoding: 'utf8' }).split('\n')[0].trim();
}

/** SFX cues whose timing drives picture in the Blender builders (sh.sfx_at). */
const PICTURE_CUES = new Set(['radio-off', 'car-door']);

function plateDir(quality: string, id: string): string {
  return path.join(GEN, quality, id);
}

async function plates(): Promise<void> {
  const quality = opt('quality', 'animatic')!;
  const only = opt('only')?.split(',');
  const jobs = Number(opt('jobs', '3'));
  const e = edit();
  const v = voices();
  const src = sourcesHash();
  const bv = blenderVersion();
  const todo: { id: string; key: string; frames: number }[] = [];
  for (const s of e.shots) {
    if (s.renderer === 'remotion') continue;
    if (only && !only.includes(s.id)) continue;
    const takes = (s.dialogue ?? []).map((d) => `${d.line}:${v[d.line]?.seconds ?? '?'}`).join(',');
    // Sound edits never re-render pictures — except the cues builders time picture to.
    const pictureCues = ((s.sfx as { cue: string }[] | undefined) ?? []).filter((c) => PICTURE_CUES.has(c.cue));
    const key = sha(JSON.stringify({ ...s, sfx: pictureCues }) + takes + src + bv + quality + e.fps + (s.renderer === 'hybrid' ? uiHash() : ''));
    const dir = plateDir(quality, s.id);
    const frames = Math.max(1, Math.round(s.dur * e.fps));
    const keyFile = path.join(dir, '.key');
    const complete = existsSync(keyFile) && readFileSync(keyFile, 'utf8') === key && existsSync(path.join(dir, `${String(frames).padStart(4, '0')}.png`));
    if (complete && !flag('force')) continue;
    todo.push({ id: s.id, key, frames });
  }
  console.log(`plates [${quality}]: ${todo.length} to render (${e.shots.filter((s) => s.renderer !== 'remotion').length - todo.length} cached), ${jobs} jobs`);
  let next = 0;
  let failed = 0;
  const t0 = Date.now();
  const worker = async (): Promise<void> => {
    while (next < todo.length) {
      const job = todo[next++];
      const dir = plateDir(quality, job.id);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const log = path.join(dir, 'render.log');
      const started = Date.now();
      const code = await new Promise<number>((resolve) => {
        const p = spawn(BLENDER, ['-b', '--factory-startup', '--python', path.join(REPO, 'tools/blender/py/hnc_cli.py'), '--', 'diaries-shot',
          '--episode', EP, '--shot', job.id, '--quality', quality, '--out', dir], { cwd: REPO });
        const chunks: Buffer[] = [];
        p.stdout.on('data', (d) => chunks.push(d));
        p.stderr.on('data', (d) => chunks.push(d));
        p.on('close', (c) => {
          writeFileSync(log, Buffer.concat(chunks));
          resolve(c ?? 1);
        });
      });
      const ok = code === 0 && existsSync(path.join(dir, `${String(job.frames).padStart(4, '0')}.png`));
      if (ok) writeFileSync(path.join(dir, '.key'), job.key);
      else failed++;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${job.id} ${job.frames}f ${((Date.now() - started) / 1000).toFixed(1)}s${ok ? '' : `  (see ${path.relative(REPO, log)})`}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  console.log(`plates done in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${failed} failed`);
  if (failed) process.exit(1);
}

function run(bin: string, argv: string[], cwd = REPO): void {
  execFileSync(bin, argv, { cwd, stdio: 'inherit', env: { ...process.env } });
}

function storyboard(): void {
  const e = edit();
  const v = voices();
  const d = JSON.parse(readFileSync(DIALOGUE, 'utf8')) as { lines: { id: string; speaker: string; text: string }[] };
  const lines = new Map(d.lines.map((l) => [l.id, l]));
  let t = 0;
  const fmt = (s: number): string => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
  const out: string[] = [
    '# 48 Hours Before Belgium — storyboard (HNC Player Diaries EP01)',
    '',
    `GENERATED from \`packages/reels/src/diaries/${EP}/edit.json\` (${e.shots.length} shots, ${e.fps} fps) by \`npm run diaries -- storyboard\`. Edit the JSON, not this file.`,
    '',
  ];
  let scene = '';
  for (const s of e.shots) {
    const frames = Math.max(1, Math.round(s.dur * e.fps));
    const a = t / e.fps;
    const b = (t + frames) / e.fps;
    if (s.scene !== scene) {
      scene = s.scene as string;
      out.push(`## ${scene}`, '');
    }
    const dl = (s.dialogue ?? []).map((x) => {
      const l = lines.get(x.line)!;
      return `${l.speaker}: “${l.text}” (@${x.at.toFixed(2)}s, ${v[x.line]?.seconds?.toFixed(2) ?? '?'}s)`;
    });
    const sfx = ((s.sfx as { cue: string; at: number }[] | undefined) ?? []).map((x) => `${x.cue}@${x.at}`).join(', ');
    out.push(
      `### \`${s.id}\` · ${fmt(a)}–${fmt(b)} · ${frames}f`,
      '',
      `| | |`,
      `|---|---|`,
      `| Location | ${s.location} |`,
      `| Framing | ${s.framing} |`,
      `| Lens | ${s.lens} |`,
      `| Camera | ${s.move} |`,
      `| Action | ${s.action} |`,
      `| Dialogue | ${dl.join('<br>') || '—'} |`,
      `| Audio | ${sfx || '—'} |`,
      `| Light | ${s.light} |`,
      `| Renderer | ${s.renderer} |`,
      `| Transition | ${s.transition} |`,
      `| Purpose | ${s.purpose} |`,
      '',
    );
    t += frames;
  }
  out.splice(3, 0, `Runtime: ${(t / e.fps).toFixed(2)} s.`);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'storyboard.md'), out.join('\n') + '\n');
  console.log(`storyboard.md: ${e.shots.length} shots, ${(t / e.fps).toFixed(2)} s`);
}

async function editRender(): Promise<void> {
  const quality = opt('quality', 'animatic')!;
  const out = path.resolve(REPO, opt('out', path.join(OUT, quality === 'final' ? 'final/reel-nomaster.mp4' : `${quality}.mp4`))!);
  run('npx', ['tsx', 'scripts/diaries-render.ts', '--episode', EP, '--quality', quality, '--out', out, ...(opt('scale') ? ['--scale', opt('scale')!] : [])], path.join(REPO, 'packages/reels'));
}

function master(): void {
  const inp = path.resolve(REPO, opt('in')!);
  const out = path.resolve(REPO, opt('out')!);
  // Two-pass EBU R128: measure, then normalise to -14 LUFS / -1.0 dBTP (social platforms).
  const measured = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${inp}" -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p'`], { encoding: 'utf8' });
  const j = JSON.parse(measured);
  const af = `loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  mkdirSync(path.dirname(out), { recursive: true });
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inp, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', '60', '-movflags', '+faststart', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', out]);
  const after = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${out}" -af loudnorm=print_format=json -f null - 2>&1 | sed -n '/{/,/}/p'`], { encoding: 'utf8' });
  const k = JSON.parse(after);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,bit_rate:stream=codec_name,width,height,r_frame_rate,sample_rate,channels', '-of', 'json', out], { encoding: 'utf8' });
  const report = { file: path.relative(REPO, out), probe: JSON.parse(probe), loudness: { integratedLUFS: Number(k.input_i), truePeakDBTP: Number(k.input_tp), lra: Number(k.input_lra) }, before: { integratedLUFS: Number(j.input_i), truePeakDBTP: Number(j.input_tp) } };
  writeFileSync(out.replace(/\.mp4$/, '.probe.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

function sheet(): void {
  const inp = path.resolve(REPO, opt('in')!);
  const out = path.resolve(REPO, opt('out')!);
  const every = Number(opt('every', '1'));
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inp, '-vf', `fps=1/${every},scale=180:-1,tile=12x7`, '-frames:v', '1', out]);
  console.log(`sheet: ${path.relative(REPO, out)}`);
}

/** Validate the cut: runtime, scene lengths, dialogue collisions (take padding tolerated). */
function check(): void {
  const e = edit();
  const v = voices();
  let t = 0;
  const events: { a: number; b: number; line: string; shot: string }[] = [];
  const scenes = new Map<string, [number, number]>();
  for (const s of e.shots) {
    const frames = Math.max(1, Math.round(s.dur * e.fps));
    const a = t / e.fps;
    const sc = scenes.get(s.scene as string) ?? [a, a];
    sc[1] = (t + frames) / e.fps;
    scenes.set(s.scene as string, sc);
    for (const d of s.dialogue ?? []) {
      const len = v[d.line]?.seconds ?? 1;
      // takes carry ~0.05 s lead-in + ~0.16 s tail of room tone
      events.push({ a: a + d.at + 0.05, b: a + d.at + len - 0.16, line: d.line, shot: s.id });
    }
    t += frames;
  }
  const total = t / e.fps;
  console.log(`runtime ${total.toFixed(2)} s (${t} frames, ${e.shots.length} shots) — target 65–72`);
  for (const [k, [a, b]] of scenes) console.log(`  ${k} ${a.toFixed(2)}–${b.toFixed(2)} (${(b - a).toFixed(2)})`);
  events.sort((x, y) => x.a - y.a);
  let bad = 0;
  for (let i = 1; i < events.length; i++) {
    const p = events[i - 1];
    const c = events[i];
    if (c.a < p.b - 0.02 && !(p.line === 'L10' || c.line === 'L10')) {
      console.log(`  OVERLAP ${p.line}(${p.shot}) ends ${p.b.toFixed(2)} > ${c.line}(${c.shot}) starts ${c.a.toFixed(2)}`);
      bad++;
    }
  }
  const last = events[events.length - 1];
  if (last && last.b > total) console.log(`  LINE PAST THE END ${last.line}`);
  if (bad) process.exitCode = 1;
}

/** OFL fonts for the edit (Barlow Condensed + Inter), with their licences. */
async function fonts(): Promise<void> {
  const dir = path.join(REPO, 'packages/reels/public/generated/diaries/fonts');
  mkdirSync(dir, { recursive: true });
  const base = 'https://github.com/google/fonts/raw/main/ofl';
  const files: [string, string][] = [
    ['BarlowCondensed-SemiBold.ttf', `${base}/barlowcondensed/BarlowCondensed-SemiBold.ttf`],
    ['BarlowCondensed-Medium.ttf', `${base}/barlowcondensed/BarlowCondensed-Medium.ttf`],
    ['Inter.ttf', `${base}/inter/Inter%5Bopsz,wght%5D.ttf`],
    ['OFL-Barlow.txt', `${base}/barlowcondensed/OFL.txt`],
    ['OFL-Inter.txt', `${base}/inter/OFL.txt`],
  ];
  for (const [name, url] of files) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
    console.log(`fonts: ${name}`);
  }
}

const commands: Record<string, () => unknown> = {
  check,
  fonts,
  // Kokoro renders each fictional character's reference timbre; Chatterbox speaks the lines in it.
  voices: () => {
    const lines = args.slice(1).filter((a) => /^L\d+$/.test(a));
    run(PY, [path.join(REPO, 'tools/diaries/py/voices.py'), DIALOGUE, path.join(GEN, 'vo'), '--refs']);
    run(CHATTERBOX_PY, [path.join(REPO, 'tools/diaries/py/voices_chatterbox.py'), DIALOGUE, path.join(GEN, 'vo'), ...lines, ...(opt('takes') ? [`--takes=${opt('takes')}`] : [])]);
  },
  plates,
  ui: () => run('npx', ['tsx', 'scripts/diaries-ui.ts', '--episode', EP], path.join(REPO, 'packages/reels')),
  audio: () => run(PY, [path.join(REPO, 'tools/diaries/py/mix.py'), EDIT, DIALOGUE, GEN]),
  edit: editRender,
  master,
  sheet,
  storyboard,
};

if (!commands[cmd]) {
  console.error(`usage: diaries <${Object.keys(commands).join('|')}> …`);
  process.exit(2);
}
await commands[cmd]();
