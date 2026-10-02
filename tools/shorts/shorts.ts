#!/usr/bin/env tsx
/**
 * HNC shorts — reusable short-form pipeline (system only, no episodes yet).
 *
 *   npm run shorts -- check    validate ShortSpec(s) + registry + voice cache
 *   npm run shorts -- voices   Qwen takes (free/local mlx-audio) -> stems + captions
 *   npm run shorts -- render   Remotion 1080x1920 assembly -> MP4 + ffprobe
 *
 * Future: `npm run shorts -- render --episode group-chat-croatia-england`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkShort, shortDuration, type ShortSpec } from '../../packages/reels/src/shorts/spec.ts';
import { SYSTEM_SMOKE } from '../../packages/reels/src/shorts/system-smoke.ts';
import { GROUP_CHAT_SPEC } from '../../packages/reels/src/shorts/group-chat-croatia-england.tsx';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REG = path.join(REPO, 'packages/reels/src/shorts/voices/registry.json');
const QWEN_PY =
  process.env.HNC_QWEN_PY ?? path.join(REPO, '..', '.tools', 'mlx-audio', '.venv', 'bin', 'python');

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string, dflt?: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

const ALL_SPECS: ShortSpec[] = [SYSTEM_SMOKE, GROUP_CHAT_SPEC as unknown as ShortSpec];
const selSpecs = (): ShortSpec[] => {
  const ep = opt('episode');
  if (!ep) return ALL_SPECS;
  const s = ALL_SPECS.find((x) => x.id === ep);
  if (!s) {
    console.error(`unknown episode ${ep} (have: ${ALL_SPECS.map((x) => x.id).join(', ')})`);
    process.exit(2);
  }
  return [s];
};
const SPECS = ALL_SPECS;
const genDir = (id: string) => path.join(REPO, 'packages/reels/public/generated/shorts', id);

/** Lines with absolute times — mirrors ShortFilm.padLines so audio/captions can never drift. */
function timedLines(spec: ShortSpec) {
  const out: { id: string; at: number; voiceId: string; text: string; delivery?: string; say?: string; tempo?: number }[] = [];
  let t = 0;
  if (spec.hook.voice) out.push({ id: `${spec.id}-hook`, at: t + (spec.hook.voice.at ?? 0.08), voiceId: spec.hook.voice.voiceId, text: spec.hook.voice.text, delivery: spec.hook.voice.delivery, say: spec.hook.voice.say, tempo: spec.hook.voice.tempo });
  t += spec.hook.duration;
  for (const s of spec.scenes) {
    if (s.voice) out.push({ id: `${spec.id}-${s.id}`, at: t + (s.voice.at ?? 0.05), voiceId: s.voice.voiceId, text: s.voice.text, delivery: s.voice.delivery, say: s.voice.say, tempo: s.voice.tempo });
    t += s.duration;
  }
  if (spec.cta.voice) out.push({ id: `${spec.id}-cta`, at: t + (spec.cta.voice.at ?? 0.05), voiceId: spec.cta.voice.voiceId, text: spec.cta.voice.text, delivery: spec.cta.voice.delivery, say: spec.cta.voice.say, tempo: spec.cta.voice.tempo });
  return { lines: out, total: t + spec.cta.duration };
}

function check(): void {
  const reg = JSON.parse(readFileSync(REG, 'utf8')) as { model: string; voices: Record<string, { status: string }> };
  console.log(`registry: ${reg.model}`);
  for (const [id, v] of Object.entries(reg.voices)) console.log(`  ${id} [${v.status}]`);
  let bad = 0;
  for (const spec of SPECS) {
    const errs = checkShort(spec);
    const { total } = timedLines(spec);
    console.log(`${spec.id}: ${spec.fps}fps 1080x1920 hook=${spec.hook.duration}s total=${shortDuration(spec).toFixed(2)}s`);
    for (const l of timedLines(spec).lines) {
      const wav = path.join(genDir(spec.id), 'vo', `${l.id}.wav`);
      console.log(`  voice ${l.id} ${l.voiceId} @${l.at.toFixed(2)}s "${l.text}" ${existsSync(wav) ? 'cached' : '(missing — run voices)'}`);
    }
    if (errs.length) {
      bad++;
      for (const e of errs) console.log(`  ERROR ${e}`);
    }
  }
  console.log(`shorts check: ${bad ? 'FAIL' : 'ok'} (${SPECS.length} spec(s), total ${timedLines(SPECS[0]).total.toFixed(2)}s)`);
  if (bad) process.exit(1);
}

function voices(): void {
  const takes = opt('takes', '2');
  for (const spec of selSpecs()) {
    const reg = JSON.parse(readFileSync(REG, 'utf8'));
    const { lines, total } = timedLines(spec);
    const dialogue = {
      schema: 'hnc-diaries-dialogue/1',
      episode: spec.id,
      speakers: Object.fromEntries(lines.map((l) => [l.voiceId, { engine: 'qwen' }])),
      lines: lines.map((l) => ({ id: l.id, speaker: l.voiceId, text: l.text, delivery: l.delivery ?? reg.voices[l.voiceId]?.deliveryDefault ?? 'natural', ...(l.say ? { say: l.say } : {}), ...(l.tempo ? { tempo: l.tempo } : {}) })),
    };
    const vo = path.join(genDir(spec.id), 'vo');
    mkdirSync(vo, { recursive: true });
    const dlg = path.join(vo, `dialogue.${spec.id}.json`);
    writeFileSync(dlg, JSON.stringify(dialogue, null, 2) + '\n');
    console.log(`qwen: ${lines.length} line(s), --takes=${takes} (max 2 for narrator bootstrap)`);
    execFileSync(QWEN_PY, [path.join(REPO, 'tools/shorts/py/qwen_shorts.py'), dlg, REG, vo, `--takes=${takes}`], { cwd: REPO, stdio: 'inherit' });
    assemble(spec.id, total);
  }
}

/** Assemble voice takes at their spec times -> stems + captions (WAV 48 kHz, like diaries mix.py). */
function assemble(id: string, total: number): void {
  const gen = genDir(id);
  const vo = path.join(gen, 'vo');
  const report = JSON.parse(readFileSync(path.join(vo, 'voices.json'), 'utf8')) as Record<string, { seconds: number }>;
  const spec = SPECS.find((s) => s.id === id)!;
  const { lines } = timedLines(spec);
  const sr = 48000;
  const n = Math.max(1, Math.round(total * sr));
  // Minimal WAV IO (float32 mono -> stereo) without extra deps; takes are already normalised.
  const readWavMono = (p: string): Float32Array => {
    const buf = readFileSync(p);
    // PCM 24-bit: parse via ffmpeg to f32 (takes are ours, 48 kHz mono/stereo).
    const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', p, '-f', 'f32le', '-ar', '48000', '-ac', '1', 'pipe:1'], { maxBuffer: 256 * 1024 * 1024 });
    return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  };
  const writeWavStereo = (p: string, left: Float32Array): void => {
    const frames = left.length;
    const data = Buffer.alloc(44 + frames * 2 * 3);
    data.write('RIFF', 0); data.writeUInt32LE(36 + frames * 6, 4); data.write('WAVE', 8);
    data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
    data.writeUInt32LE(sr, 24); data.writeUInt32LE(sr * 6, 28); data.writeUInt16LE(6, 32); data.writeUInt16LE(24, 34);
    data.write('data', 36); data.writeUInt32LE(frames * 6, 40);
    for (let i = 0; i < frames; i++) {
      const v = Math.max(-1, Math.min(1, left[i]));
      const q = Math.round(v * 8388607);
      const off = 44 + i * 6;
      data[off] = q & 0xff; data[off + 1] = (q >> 8) & 0xff; data[off + 2] = (q >> 16) & 0xff;
      data[off + 3] = q & 0xff; data[off + 4] = (q >> 8) & 0xff; data[off + 5] = (q >> 16) & 0xff;
    }
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, data);
  };
  const voice = new Float32Array(n);
  for (const l of lines) {
    const take = readWavMono(path.join(vo, `${l.id}.wav`));
    const at = Math.round(l.at * sr);
    for (let i = 0; i < take.length && at + i < n; i++) voice[at + i] += take[i];
  }
  let peak = 0;
  for (const v of voice) peak = Math.max(peak, Math.abs(v));
  let g = 1;
  if (peak > 0.98) g = 0.98 / peak;
  if (g !== 1) for (let i = 0; i < n; i++) voice[i] *= g;
  const out = path.join(gen, 'audio');
  writeWavStereo(path.join(out, 'voice.wav'), voice);
  // Four-stem architecture: voice (above) + procedural sfx/room, silent music bed.
  // Music stays silent: no royalty-free bed is vendored; a rhythmic bed can be
  // dropped in later without changing the assembly contract.
  const sfx = new Float32Array(n);
  const room = new Float32Array(n);
  if (id === 'group-chat-croatia-england') {
    // Deterministic procedural SFX, keyed to the episode's chat timeline
    // (overlay zero = hook 1.4 s; final at punchline 10.7 + 0.35 s).
    const chatAt = [1.6, 2.5, 3.75, 5.1, 6.2, 6.7, 7.2, 7.8, 8.4, 9.0, 9.6];
    const joinAt = [3.35, 4.65];
    const finalAt = 11.05;
    const blip = (at: number, f0: number, f1: number, dur = 0.07, amp = 0.35): void => {
      const s0 = Math.round(at * sr);
      const m = Math.round(dur * sr);
      for (let i = 0; i < m && s0 + i < n; i++) {
        const u = i / m;
        const f = f0 + (f1 - f0) * u;
        sfx[s0 + i] += amp * Math.sin(2 * Math.PI * f * (i / sr)) * Math.sin(Math.PI * u);
      }
    };
    const buzz = (at: number, dur = 0.16, amp = 0.22): void => {
      const s0 = Math.round(at * sr);
      const m = Math.round(dur * sr);
      for (let i = 0; i < m && s0 + i < n; i++) {
        const u = i / m;
        sfx[s0 + i] += amp * Math.sin(2 * Math.PI * 150 * (i / sr)) * Math.sin(Math.PI * u);
        sfx[s0 + i] += 0.06 * Math.sin(2 * Math.PI * 300 * (i / sr)) * Math.sin(Math.PI * u);
      }
    };
    const thump = (at: number, amp = 0.3): void => {
      const s0 = Math.round(at * sr);
      const m = Math.round(0.12 * sr);
      let seed = s0 + 1;
      const rnd = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff - 0.5;
      };
      for (let i = 0; i < m && s0 + i < n; i++) {
        const u = i / m;
        sfx[s0 + i] += amp * rnd() * Math.exp(-u * 9) + 0.18 * Math.sin(2 * Math.PI * 110 * (i / sr)) * Math.exp(-u * 7);
      }
    };
    chatAt.forEach((t, i) => blip(t, 880 + (i % 3) * 60, 620, 0.07, 0.32));
    joinAt.forEach((t) => buzz(t - 0.05));
    // Card impacts through the meltdown tail + final notification ding.
    [7.0, 7.6, 8.2, 8.8, 9.4, 10.0].forEach((t) => thump(t, 0.26));
    blip(finalAt, 1040, 1040, 0.09, 0.3);
    blip(finalAt + 0.11, 1380, 1380, 0.12, 0.28);
    // Room tone: very low deterministic bed so dialogue never sits on digital silence.
    let rseed = 123456789;
    const rrnd = (): number => {
      rseed = (rseed * 1103515245 + 12345) & 0x7fffffff;
      return rseed / 0x7fffffff - 0.5;
    };
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += 0.02 * (rrnd() - lp);
      room[i] = lp * 0.5 + 0.004 * Math.sin(2 * Math.PI * 50 * (i / sr));
    }
  } else {
    // System smoke: keep silent beds.
  }
  let speak = 0;
  for (const v of sfx) speak = Math.max(speak, Math.abs(v));
  if (speak > 0.98) {
    const g2 = 0.98 / speak;
    for (let i = 0; i < n; i++) sfx[i] *= g2;
  }
  let rpeak = 0;
  for (const v of room) rpeak = Math.max(rpeak, Math.abs(v));
  if (rpeak > 0.12) {
    const g3 = 0.12 / rpeak;
    for (let i = 0; i < n; i++) room[i] *= g3;
  }
  writeWavStereo(path.join(out, 'sfx.wav'), sfx);
  writeWavStereo(path.join(out, 'music.wav'), new Float32Array(n));
  writeWavStereo(path.join(out, 'room.wav'), room);
  const caps = lines.map((l) => {
    const secs = report[l.id]?.seconds ?? 1.2;
    return { id: l.id, speaker: l.voiceId, text: l.text, a: l.at + 0.04, b: l.at + Math.max(0.8, secs - 0.1) };
  });
  const ts = (x: number): string => {
    const ms = Math.round(x * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  writeFileSync(path.join(out, 'captions.srt'), caps.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(Math.max(c.b, c.a + 0.7))}\n${c.text}\n`).join('\n') + '\n');
  writeFileSync(path.join(out, 'captions.json'), JSON.stringify({ total, captions: caps }, null, 2) + '\n');
  writeFileSync(path.join(out, 'mix.json'), JSON.stringify({ total, peak: Number((peak * g).toFixed(3)), gain: Number(g.toFixed(3)) }, null, 2) + '\n');
  console.log(`audio: ${total.toFixed(2)}s voice peak ${(peak * g).toFixed(3)} -> ${path.relative(REPO, out)}/voice.wav (+ silent sfx/music/room)`);
}

async function render(): Promise<void> {
  const episode = opt('episode');
  const { video } = await import('../../packages/reels/scripts/lib/remotion.ts');
  const scale = Number(opt('scale', '1'));
  const targets = episode ? selSpecs() : [ALL_SPECS[0]];
  const compFor = (id: string): string => (id === 'group-chat-croatia-england' ? 'HNCShortGroupChatCroatiaEngland' : 'HNCShortSystemSmoke');
  const defaultOut = (id: string): string =>
    id === 'group-chat-croatia-england'
      ? 'social/output/shorts/group-chat-croatia-england/group-chat-croatia-england.mp4'
      : 'social/output/shorts/system-smoke/hnc-short-system-smoke.mp4';
  for (const spec of targets) {
    const out = path.resolve(REPO, opt('out', defaultOut(spec.id))!);
    console.log(`${compFor(spec.id)} ${spec.id} [60fps captions] -> ${path.relative(REPO, out)}`);
    const voicesJson = path.join(genDir(spec.id), 'vo', 'voices.json');
    const voicesMap = existsSync(voicesJson) ? (JSON.parse(readFileSync(voicesJson, 'utf8')) as Record<string, { seconds: number }>) : {};
    const inputProps = spec.id === 'group-chat-croatia-england' ? { spec: GROUP_CHAT_SPEC, voices: voicesMap } : { spec: SYSTEM_SMOKE, voices: voicesMap };
    await video(compFor(spec.id), inputProps, out, { scale });
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels,codec_type', '-of', 'json', out], { encoding: 'utf8' });
    writeFileSync(out.replace(/\.mp4$/, '.probe.json'), probe);
    console.log(probe);
  }
}

if (!{ check, voices, render }[cmd ?? '']) {
  console.error('usage: shorts <check|voices|render> [--takes=2] [--out <mp4>] [--scale 1] [--episode <id>]');
  process.exit(2);
}
await { check, voices, render }[cmd!]();
