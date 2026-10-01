/** Interactive, resumable 60fps delivery renderer for Player Diaries. */
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { findBlender } from '../blender/src/paths.ts';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FPS = 60, WIDTH = 1080, HEIGHT = 1920, SAMPLES = 256, PROFILE = 'final60';
type Shot = { id: string; dur: number; renderer: 'blender' | 'remotion' | 'hybrid'; [key: string]: unknown };
type Edit = { episode: string; title: string; fps: number; shots: Shot[] };
const frames = (dur: number, fps: number) => { const x = dur * fps, f = Math.floor(x); return Math.max(1, x - f === .5 ? (f % 2 ? f + 1 : f) : Math.round(x)); };
const args = process.argv.slice(3);
const option = (n: string) => { const i = args.indexOf(`--${n}`); return i < 0 ? undefined : args[i + 1]; };
const has = (n: string) => args.includes(`--${n}`);
const episode = option('episode') ?? 'italy-rematch';
const editPath = path.join(REPO, 'packages/reels/src/diaries', episode, 'edit.json');
const root = path.join(REPO, 'social/output/player-diaries', episode, PROFILE);
const statePath = path.join(root, 'render-state.json');
const logPath = path.join(root, 'logs/render.log');
const blender = findBlender();
const sha = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
const edit = (): Edit => JSON.parse(readFileSync(editPath, 'utf8'));
const log = (s: string) => { mkdirSync(path.dirname(logPath), { recursive: true }); writeFileSync(logPath, `[${new Date().toISOString()}] ${s}\n`, { flag: 'a' }); };
const q = (bin: string, a: string[]) => execFileSync(bin, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const pad = (n: number) => String(n).padStart(4, '0');
const validPng = (p: string) => { try { return statSync(p).size > 100 && readFileSync(p).subarray(1, 4).toString() === 'PNG'; } catch { return false; } };
const shotFrames = (s: Shot) => frames(s.dur, FPS);
const expectedTotal = (e = edit()) => e.shots.reduce((n, s) => n + shotFrames(s), 0);
const shotDir = (s: Shot) => path.join(root, s.renderer === 'remotion' ? 'remotion' : 'frames', s.id);
const sourceFor = (s: Shot) => path.join(REPO, 'tools/blender/py/hnc_blender/diaries', episode.replace(/-/g, '_'), `s${s.id.slice(1, 3)}.py`);
const keyFor = (s: Shot) => sha(JSON.stringify({ shot: s, profile: PROFILE, fps: FPS, width: WIDTH, height: HEIGHT, samples: SAMPLES, source: existsSync(sourceFor(s)) ? readFileSync(sourceFor(s)) : '' }));
type State = { episode: string; profile: string; startedAt?: string; lastUpdatedAt: string; interrupted?: boolean; shots: Record<string, { key: string; completed: number; frames: number; elapsedMs?: number }> };
const loadState = (): State => existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { episode, profile: PROFILE, lastUpdatedAt: new Date().toISOString(), shots: {} };
const saveState = (s: State) => { s.lastUpdatedAt = new Date().toISOString(); mkdirSync(root, { recursive: true }); writeFileSync(statePath, JSON.stringify(s, null, 2) + '\n'); };

function missingImplementations(e: Edit) {
  return e.shots.filter(s => s.renderer !== 'remotion' && (!existsSync(sourceFor(s)) || !new RegExp(`\\b${s.id}\\b`).test(readFileSync(sourceFor(s), 'utf8')))).map(s => s.id);
}
function preflight(): boolean {
  const e = edit(), issues: string[] = [];
  const total30 = e.shots.reduce((n, s) => n + frames(s.dur, e.fps), 0);
  if (e.shots.length !== 25) issues.push(`expected 25 shots, found ${e.shots.length}`);
  if (Math.abs(total30 / e.fps - 48.5) > 1e-9) issues.push(`runtime ${(total30 / e.fps).toFixed(3)}s, expected 48.500s`);
  const missing = missingImplementations(e); if (missing.length) issues.push(`missing shot implementations: ${missing.join(', ')}`);
  for (const p of [editPath, path.join(REPO, 'social/blender/generated/manifest.json')]) if (!existsSync(p)) issues.push(`missing required input: ${path.relative(REPO, p)}`);
  const bins: [string, string[]][] = [[blender, ['--version']], ['ffmpeg', ['-version']], ['ffprobe', ['-version']], ['node', ['--version']]];
  for (const [bin, a] of bins) try { console.log(`${bin}: ${q(bin, a).split('\n')[0]}`); } catch { issues.push(`unavailable application: ${bin}`); }
  let free = 0; try { free = Number(q('df', ['-k', existsSync(root) ? root : REPO]).trim().split('\n').at(-1)?.trim().split(/\s+/).at(3) ?? 0) * 1024; } catch { /* optional */ }
  const diskEstimate = expectedTotal(e) * 2_500_000 + 3_000_000_000; // conservative PNG planning allowance
  console.log(`Episode: ${e.title} — ${e.shots.length} shots, ${(total30 / e.fps).toFixed(3)}s / ${expectedTotal(e)} delivery frames`);
  console.log(`Profile: ${PROFILE} ${WIDTH}x${HEIGHT} ${FPS}fps EEVEE ${SAMPLES} samples`);
  console.log(`Disk: ${(free / 1e9).toFixed(1)} GB free; rough requirement ${(diskEstimate / 1e9).toFixed(1)} GB`);
  console.log(`Hardware: ${os.type()} ${os.release()}, ${os.cpus()[0]?.model ?? 'unknown CPU'}, ${(os.totalmem() / 2 ** 30).toFixed(1)} GB RAM`);
  if (free && free < diskEstimate) console.warn('WARNING: available disk appears unsafe for lossless frame cache.');
  if (issues.length) { console.error(`BLOCKED: ${issues.some(x => x.startsWith('missing shot')) ? 'missing shot implementations' : 'preflight failed'}`); issues.forEach(x => console.error(` - ${x}`)); return false; }
  console.log('Preflight: PASS'); return true;
}
function cached(s: Shot, state: State) { const d = shotDir(s), count = shotFrames(s); return state.shots[s.id]?.key === keyFor(s) && Array.from({ length: count }, (_, i) => validPng(path.join(d, `${pad(i + 1)}.png`))).every(Boolean); }
function estimate() { const e = edit(), st = loadState(); let done = 0; for (const s of e.shots) if (cached(s, st)) done += shotFrames(s); const history = Object.values(st.shots).filter(x => x.elapsedMs && x.completed).map(x => x.elapsedMs! / x.completed); const avg = history.length ? history.reduce((a, b) => a + b, 0) / history.length : undefined; console.log(`Frames: ${expectedTotal(e)} total; ${done} cached; ${expectedTotal(e) - done} requiring render`); console.log(avg ? `Estimate: ${(avg * (expectedTotal(e) - done) / 3600000).toFixed(1)}h Blender/Remotion plus assembly (estimate only)` : 'Estimate: no final60 history yet; run a representative shot to establish timing.'); }
function makePublicLink() { const target = path.join(REPO, 'packages/reels/public/generated/diaries', episode, PROFILE), source = path.join(root, 'frames'); mkdirSync(path.dirname(target), { recursive: true }); try { if (existsSync(target)) return; symlinkSync(source, target, 'dir'); } catch (error) { throw new Error(`cannot expose final frame cache to Remotion: ${String(error)}`); } }
async function runBlender(s: Shot, state: State, dry = false) {
  const d = shotDir(s); mkdirSync(d, { recursive: true }); const count = shotFrames(s); const existing = Array.from({ length: count }, (_, i) => validPng(path.join(d, `${pad(i + 1)}.png`))).filter(Boolean).length;
  const command = ['-b', '--factory-startup', '--python', path.join(REPO, 'tools/blender/py/hnc_cli.py'), '--', 'diaries-shot', '--episode', episode, '--shot', s.id, '--quality', PROFILE, '--fps', String(FPS), '--out', d, '--frames', `${Math.max(1, existing)}-${count}`];
  if (dry) { console.log(`${blender} ${command.join(' ')}`); return; }
  const start = Date.now(); log(`START ${s.id}: ${blender} ${command.join(' ')}`);
  const p = spawn(blender, command, { cwd: REPO }); let raw = '', lastFrame = 0;
  const ingest = (x: Buffer) => { const text = x.toString(); raw += text; const match = text.match(/Fra:(\d+)/g); if (match) { lastFrame = Number(match.at(-1)!.slice(4)); if (process.stdout.isTTY) process.stdout.write(`\r${s.id} frame ${Math.min(count, lastFrame)}/${count} (${Math.floor(Math.min(count, lastFrame) / count * 100)}%)`); } };
  p.stdout.on('data', ingest); p.stderr.on('data', ingest);
  await new Promise<void>((resolve, reject) => p.on('close', code => code === 0 ? resolve() : reject(new Error(`${s.id} exited ${code}\n${raw.slice(-2000)}`))));
  const complete = Array.from({ length: count }, (_, i) => validPng(path.join(d, `${pad(i + 1)}.png`))).filter(Boolean).length;
  state.shots[s.id] = { key: keyFor(s), completed: complete, frames: count, elapsedMs: Date.now() - start }; saveState(state); log(`END ${s.id}: ${complete}/${count}`);
  if (complete !== count) throw new Error(`${s.id}: missing or corrupt cached frame`);
}
async function runRemotion(s: Shot, state: State, dry = false) {
  const d = shotDir(s); mkdirSync(d, { recursive: true }); const count = shotFrames(s);
  const command = ['tsx', 'scripts/diaries-final-frames.ts', '--episode', episode, '--shot', s.id, '--out', d, '--fps', String(FPS), '--quality', PROFILE];
  if (dry) { console.log(`npx ${command.join(' ')}`); return; }
  const start = Date.now(); log(`START ${s.id}: npx ${command.join(' ')}`);
  const p = spawn('npx', command, { cwd: path.join(REPO, 'packages/reels') }); let raw = ''; p.stdout.on('data', x => raw += x); p.stderr.on('data', x => raw += x);
  await new Promise<void>((resolve, reject) => p.on('close', code => code === 0 ? resolve() : reject(new Error(`${s.id} exited ${code}\n${raw.slice(-2000)}`))));
  const complete = Array.from({ length: count }, (_, i) => validPng(path.join(d, `${pad(i + 1)}.png`))).filter(Boolean).length;
  state.shots[s.id] = { key: keyFor(s), completed: complete, frames: count, elapsedMs: Date.now() - start }; saveState(state); log(`END ${s.id}: ${complete}/${count}`);
  if (complete !== count) throw new Error(`${s.id}: missing or corrupt Remotion frame`);
}
async function render(selected?: string, dry = false) {
  const ready = preflight();
  if (!ready && !dry) process.exitCode = 2; else {
    if (!ready) console.log('Dry-run only: preflight is blocked, so no work will be launched.');
    makePublicLink(); const e = edit(), st = loadState(); st.startedAt ??= new Date().toISOString(); st.interrupted = false; saveState(st);
    const todo = e.shots.filter(s => !selected || s.id === selected); if (selected && !todo.length) throw new Error(`unknown shot ${selected}`);
    let complete = 0; const all = expectedTotal(e); const interrupt = () => { st.interrupted = true; saveState(st); console.error(`\nRender interrupted safely. Resume:\nnpm run diaries -- final-render --episode ${episode} --profile ${PROFILE} --resume`); process.exitCode = 130; };
    process.once('SIGINT', interrupt);
    for (let i = 0; i < todo.length && !st.interrupted; i++) { const s = todo[i]; if (cached(s, st)) { complete += shotFrames(s); console.log(`[${i + 1}/${todo.length}] ${s.id} cached (${complete}/${all})`); continue; } console.log(`[${i + 1}/${todo.length}] ${s.id} ${shotFrames(s)} frames`); if (s.renderer === 'remotion') await runRemotion(s, st, dry); else await runBlender(s, st, dry); complete += shotFrames(s); }
    process.removeListener('SIGINT', interrupt);
  }
}
function audioInput() { return [path.join(REPO, 'packages/reels/public/generated/diaries', episode, 'audio', 'mix.wav'), path.join(REPO, 'packages/reels/public/generated/diaries', episode, 'audio', 'master.wav')].find(existsSync); }
function assemble() {
  const e = edit(), st = loadState(); if (e.shots.some(s => !cached(s, st))) throw new Error('assemble blocked: not every final60 frame is cached');
  const out = path.join(root, 'masters'); mkdirSync(out, { recursive: true }); const inputs = e.shots.flatMap(s => ['-framerate', String(FPS), '-i', path.join(shotDir(s), '%04d.png')]); const filter = `${e.shots.map((_, i) => `[${i}:v]`).join('')}concat=n=${e.shots.length}:v=1:a=0[v]`; const audio = audioInput(); const prores = path.join(out, `${episode}-${PROFILE}-prores.mov`), watch = path.join(out, `${episode}-${PROFILE}.mp4`);
  const common = [...inputs, ...(audio ? ['-i', audio] : []), '-filter_complex', filter, '-map', '[v]', ...(audio ? ['-map', `${e.shots.length}:a?`, '-c:a', 'pcm_s24le'] : []), '-r', String(FPS)];
  execFileSync('ffmpeg', ['-hide_banner', '-y', ...common, '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', prores], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-hide_banner', '-y', '-i', prores, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', ...(audio ? ['-c:a', 'aac', '-b:a', '256k'] : ['-an']), watch], { stdio: 'inherit' });
  console.log(audio ? `Audio: included (${audio})` : 'Audio: NOT INCLUDED — no final mix found'); validate(watch); report(prores, watch);
}
function validate(file: string) { const probe = JSON.parse(q('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate,nb_read_frames', '-of', 'json', file])); const video = probe.streams.find((s: any) => s.width); const ok = video?.width === WIDTH && video?.height === HEIGHT && video?.r_frame_rate === '60/1' && Math.abs(Number(probe.format.duration) - 48.5) < .05 && Number(video.nb_read_frames) === expectedTotal(); if (!ok) throw new Error(`validation failed: ${JSON.stringify(probe)}`); console.log(`Validation: PASS (${video.nb_read_frames} frames, ${probe.format.duration}s)`); }
function report(prores: string, watch: string) {
  const e = edit(), st = loadState(), rows = e.shots.map(s => ({ shot: s.id, frames: shotFrames(s), cached: cached(s, st), renderSeconds: (st.shots[s.id]?.elapsedMs ?? 0) / 1000 }));
  const rendered = rows.reduce((n, r) => n + r.frames, 0), elapsed = rows.reduce((n, r) => n + r.renderSeconds, 0);
  const info = { episode, profile: PROFILE, gitHead: q('git', ['rev-parse', 'HEAD']).trim(), resolution: `${WIDTH}x${HEIGHT}`, fps: FPS, engine: 'EEVEE', samples: SAMPLES, hardware: { os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, ramGB: os.totalmem() / 2 ** 30 }, totalFrames: expectedTotal(e), renderedFrames: rendered, cachedFrames: rows.filter(r => r.cached).reduce((n, r) => n + r.frames, 0), blenderAndRemotionSeconds: elapsed, averageSecondsPerFrame: elapsed / Math.max(1, rendered), shots: rows, outputs: [prores, watch].map(p => ({ path: p, bytes: statSync(p).size, probe: JSON.parse(q('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate', '-of', 'json', p])) })) };
  const dir = path.join(root, 'reports'); mkdirSync(dir, { recursive: true }); writeFileSync(path.join(dir, 'render-report.json'), JSON.stringify(info, null, 2) + '\n');
  writeFileSync(path.join(dir, 'render-report.md'), `# Final render report\n\n- Episode: ${e.title}\n- Profile: ${PROFILE}\n- Git: ${info.gitHead}\n- Delivery: ${WIDTH}×${HEIGHT}, ${FPS} fps, EEVEE, ${SAMPLES} samples\n- Frames: ${info.totalFrames}\n- Timed rendering: ${(elapsed / 60).toFixed(1)} min\n- Average: ${info.averageSecondsPerFrame.toFixed(2)} sec/frame\n\n## Outputs\n\n- ${prores} (${(statSync(prores).size / 1e9).toFixed(2)} GB)\n- ${watch} (${(statSync(watch).size / 1e9).toFixed(2)} GB)\n\n## Shot performance\n\n| Shot | Frames | Render seconds | Cached |\n|---|---:|---:|---|\n${rows.map(r => `| ${r.shot} | ${r.frames} | ${r.renderSeconds.toFixed(1)} | ${r.cached ? 'yes' : 'no'} |`).join('\n')}\n`);
}
async function menu() { console.log(`\nHNC Player Diaries — Final Renderer\n\nEpisode: ${episode}\nProfile: ${PROFILE}\nResolution: ${WIDTH}×${HEIGHT}\nFPS: ${FPS}\nBlender: EEVEE\nSamples: ${SAMPLES}\n\n[1] Preflight\n[2] Estimate render\n[3] Render / resume full film\n[4] Render selected shot\n[5] Show render status\n[6] Assemble master only\n[7] Validate finished render\n[8] Open final video\n[q] Quit`); const rl = readline.createInterface({ input, output }); const a = await rl.question('> '); if (a === '1') preflight(); else if (a === '2') estimate(); else if (a === '3') await render(); else if (a === '4') await render(await rl.question('Shot ID: ')); else if (a === '5') estimate(); else if (a === '6') assemble(); else if (a === '7') validate(path.join(root, 'masters', `${episode}-${PROFILE}.mp4`)); else if (a === '8') spawn('open', [path.join(root, 'masters', `${episode}-${PROFILE}.mp4`)], { detached: true }); rl.close(); }
export async function finalRender() {
  if (option('profile') && option('profile') !== PROFILE) throw new Error(`only ${PROFILE} is supported`);
  const action = ['preflight', 'estimate', 'resume', 'shot', 'assemble-only', 'validate', 'dry-run'].some(has);
  if (process.stdout.isTTY && !action) return menu();
  if (has('preflight')) return void preflight(); if (has('estimate')) return void estimate(); if (has('assemble-only')) return void assemble(); if (has('validate')) return void validate(path.join(root, 'masters', `${episode}-${PROFILE}.mp4`)); await render(option('shot'), has('dry-run'));
}
