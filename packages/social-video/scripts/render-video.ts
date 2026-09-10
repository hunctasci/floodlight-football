#!/usr/bin/env tsx
/**
 * `social:render` CLI — the complete deterministic HNC League MP4 pipeline:
 *
 *   validate spec → compile video → render deterministic PNG frames →
 *   render deterministic audio → FFmpeg H.264/AAC encode → probe + validate.
 *
 *   npm run social:render -- --scene attack-goal --home TR --away GR \
 *     --seed 42 --output social/output/tr-vs-gr.mp4
 *
 * Frames render into a temp working dir (deleted on success) or
 * `<output>.frames/` with --keep-frames. On failure the working dir is
 * preserved and its location printed for debugging.
 */
import type { ChildProcess } from 'node:child_process';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { compileAudioPlan } from '../src/audio/compile';
import { renderAudioToWav } from '../src/audio/render';
import { renderStereoMix, encodeStereoWav } from '../src/audio/mix';
import type { CompiledAudio } from '../src/audio/types';
import { EncoderNotFoundError, resolveFfmpeg, resolveFfprobe } from '../src/encode/ffmpeg';
import { buildEncodeArgs, runFfmpeg } from '../src/encode/video';
import {
  hasFaststart, probeMedia, validateMedia, ProbeError, type ProbedMedia,
} from '../src/encode/probe';
import { SocialRenderSession } from '../src/render/session';
import { clearFramePngs } from '../src/render/frame';
import { compileVideo, frameFilename } from '../src/timeline';
import { compileTemplate } from '../src/templates/compile';
import type { CompiledTemplate } from '../src/templates/types';
import { compileTrailer } from '../src/trailers/compile';
import type { CompiledTrailer } from '../src/trailers/types';
import { resolveVideoSpec, resolveTrailerSpec, SocialSpecError } from '../src/schema';
import { argStr, outputFromArgs, readArgs, specInputFromArgs, trailerInputFromArgs } from './cli-args';

const execFileAsync = promisify(execFile);

function usage(): string {
  return [
    'Usage: social:render --home <CODE> --away <CODE> --output <video.mp4> [--scene faceoff|attack-goal] [--template country-rivalry-reel] [--trailer world-league-hero --countries TR,GR,BR,AR,DE,FR] [--format reel] [--seed 42] [--fps 30] [--duration <sec>] [--attack-team home|away] [--attack-style central|wing|counter] [--headline <text>] [--secondary <text>] [--cta <text>] [--no-overlays] [--music <file.mp3>] [--music-volume 0.25] [--crowd-mode real|procedural] [--audio-plan] [--keep-frames] [--force]',
    '',
    'Examples:',
    '  npm run social:render -- --scene attack-goal --home TR --away GR --seed 42 --output social/output/tr-vs-gr.mp4',
    '  npm run social:render -- --template country-rivalry-reel --home TR --away GR --seed 42 --output social/output/tr-vs-gr-reel.mp4',
    '  npm run social:render -- --trailer world-league-hero --countries TR,GR,BR,AR,DE,FR --seed 42 --output social/output/world-league-hero.mp4',
    '',
    'Examples:',
    '  npm run social:render -- --scene attack-goal --home TR --away GR --seed 42 --output social/output/tr-vs-gr.mp4',
    '  npm run social:render -- --scene faceoff --home TR --away GR --output social/output/faceoff.mp4',
    '  npm run social:render -- --scene attack-goal --home TR --away GR --music ./my-track.mp3 --output social/output/tr-vs-gr.mp4',
    '',
    'Country codes come from the game\'s canonical country list (e.g. TR GR BR AR DE FR).',
    'Defaults: scene=faceoff format=reel seed=42 fps=30 duration=4 (faceoff), 9.5 (attack-goal), 8 (cross-header-goal), 9.5 (crossbar-chaos), 10.5 (keeper-disaster) overlays=default music-volume=0.25.',
    'Trailer defaults: fps=60 duration=17.6 (world-league-hero); pass --countries TR,GR,BR,AR,DE,FR instead of --home/--away.',
    'Refuses to overwrite an existing MP4 unless --force is given. Temp frames are deleted unless --keep-frames.',
  ].join('\n');
}

function fail(message: string, workDir: string | null): never {
  console.error(message);
  if (workDir) {
    console.error('');
    console.error('Render failed.');
    console.error('Diagnostic files preserved at:');
    console.error(workDir);
  }
  process.exitCode = 1;
  throw new Error(message);
}

function parseMusicVolume(raw: string | undefined): number {
  if (raw === undefined) return 0.25;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new SocialSpecError(`Invalid music volume: ${raw}. Supported range is 0–1.`);
  }
  return n;
}

/**
 * Last-resort validation when ffprobe is missing but ffmpeg exists: parse
 * `ffmpeg -i` metadata output for codec/size/fps/duration/audio presence.
 */
async function probeViaFfmpeg(ffmpeg: string, file: string): Promise<ProbedMedia> {
  let stderr = '';
  try {
    await execFileAsync(ffmpeg, ['-hide_banner', '-i', file]);
  } catch (error) {
    const err = error as { stderr?: string };
    stderr = String(err.stderr ?? '');
  }
  const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr);
  const video = /Stream #\d+:\d+.*Video: (\w+)[^,]*, [^,]*, (\d+)x(\d+)[^,]*, [\d.]+ tbr, ([\d.]+) fps/.exec(stderr);
  const audio = /Stream #\d+:\d+.*Audio: (\w+)/.exec(stderr);
  const pixFmt = /yuv420p/.test(stderr) ? 'yuv420p' : null;
  if (!video) throw new ProbeError(`ffmpeg metadata parse failed for ${file}`);
  return {
    codecVideo: video[1],
    codecAudio: audio?.[1] ?? null,
    width: Number(video[2]),
    height: Number(video[3]),
    fps: Number(video[4]),
    duration: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : NaN,
    pixFmt,
    hasFaststart: null,
  };
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  if (args.get('help') === true || args.get('h') === true) {
    console.log(usage());
    return;
  }
  const output = outputFromArgs(args);
  if (!output) {
    console.error('Missing required --output <video.mp4> (e.g. --output social/output/tr-vs-gr.mp4)');
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  if (!output.toLowerCase().endsWith('.mp4')) {
    console.error(`Output must be an .mp4 file (got "${output}")`);
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const force = args.get('force') === true;
  if (existsSync(output) && !force) {
    console.error(`Output already exists: ${output}`);
    console.error('Pass --force to overwrite it.');
    process.exitCode = 1;
    return;
  }
  const musicPath = argStr(args, 'music');
  if (musicPath !== undefined) {
    try {
      if (!statSync(musicPath).isFile()) throw new Error();
    } catch {
      console.error(`Music file not found: ${musicPath}`);
      process.exitCode = 1;
      return;
    }
  }
  let musicVolume = 0.25;
  try {
    musicVolume = parseMusicVolume(argStr(args, 'music-volume') ?? argStr(args, 'musicVolume'));
  } catch (error) {
    console.error(error instanceof SocialSpecError ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  let video;
  let trailerResolved = null as null | ReturnType<typeof resolveTrailerSpec>;
  try {
    if (argStr(args, 'trailer') !== undefined) {
      trailerResolved = resolveTrailerSpec(trailerInputFromArgs(args));
      video = null;
    } else {
      video = resolveVideoSpec(specInputFromArgs(args));
    }
  } catch (error) {
    console.error(error instanceof SocialSpecError ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  // Exactly one of scene / template / trailer renders: a trailer compiles to
  // global montage segments + audio, a template to global segments + audio, a
  // scene to a single timeline. Downstream code only sees shared counters
  // (frames/fps/duration/dims) plus an audio plan.
  const trl: CompiledTrailer | null = trailerResolved !== null
    ? compileTrailer(trailerInputFromArgs(args))
    : null;
  const tpl: CompiledTemplate | null = trl === null && video !== null && video.template !== undefined
    ? compileTemplate(specInputFromArgs(args))
    : null;
  const compiled = trl === null && tpl === null ? compileVideo(video!) : null;
  const audioPlan: CompiledAudio = trl !== null ? trl.audio : tpl !== null ? tpl.audio : compileAudioPlan(compiled!);
  const totalFrames = trl?.totalFrames ?? tpl?.totalFrames ?? compiled!.totalFrames;
  const fps = trl?.fps ?? tpl?.fps ?? compiled!.fps;
  const duration = trl?.duration ?? tpl?.duration ?? compiled!.duration;
  const width = trl?.width ?? tpl?.width ?? compiled!.width;
  const height = trl?.height ?? tpl?.height ?? compiled!.height;
  const seed = trl?.seed ?? tpl?.seed ?? compiled!.seed;
  const whatLine = trl !== null ? `Trailer: ${trl.trailer}` : tpl !== null ? `Template: ${tpl.template}` : `Scene: ${compiled!.scene}`;
  const matchupLine = trl !== null
    ? `Matchups: ${trl.countries.slice(0, 2).join(' vs ')} · ${trl.countries.slice(2, 4).join(' vs ')} · ${trl.countries.slice(4, 6).join(' vs ')}`
    : `Matchup: ${video!.home} vs ${video!.away}`;
  // Fail fast when the encoder is missing — before opening a browser.
  let ffmpeg: string;
  try {
    ffmpeg = resolveFfmpeg();
  } catch (error) {
    console.error(error instanceof EncoderNotFoundError ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const dryRun = args.get('dry-run') === true || args.get('dryRun') === true;
  if (dryRun) {
    console.log(JSON.stringify({
      ...(trl ?? video),
      audioEvents: audioPlan.events,
      sampleRate: audioPlan.sampleRate,
      music: musicPath ?? null,
      musicVolume,
      output,
    }));
    return;
  }

  const keepFrames = args.get('keep-frames') === true || args.get('keepFrames') === true;
  const stems = args.get('stems') === true;
  const monoLegacy = args.get('mono') === true || args.get('mono-legacy') === true;
  const crowdModeRaw = argStr(args, 'crowd-mode') ?? argStr(args, 'crowdMode') ?? 'real';
  if (crowdModeRaw !== 'real' && crowdModeRaw !== 'procedural') {
    console.error(`Invalid crowd mode: ${crowdModeRaw}. Supported: real|procedural.`);
    process.exitCode = 1;
    return;
  }
  const crowdMode = crowdModeRaw as 'real' | 'procedural';
  const audioPlanDebug = args.get('audio-plan') === true || args.get('audioPlan') === true;
  const framesDir = keepFrames
    ? path.resolve(`${output}.frames`)
    : await mkdtemp(path.join(os.tmpdir(), 'hnc-social-'));
  mkdirSync(framesDir, { recursive: true });
  if (keepFrames) await clearFramePngs(framesDir);
  const sfxPath = path.join(framesDir, 'sfx.wav');

  // Owned resources for SIGINT/SIGTERM cleanup: kill the encoder, close the
  // browser session (which also stops the Vite server), keep diagnostics.
  const state: { session?: SocialRenderSession; ffmpeg?: ChildProcess; done: boolean } = { done: false };
  const onSignal = (signal: string): void => {
    if (state.done) return;
    state.done = true;
    console.error(`\nReceived ${signal} — cleaning up…`);
    try {
      state.ffmpeg?.kill('SIGTERM');
    } catch { /* already gone */ }
    void state.session?.close().finally(() => {
      console.error('Diagnostic files preserved at:');
      console.error(framesDir);
      process.exit(130);
    });
    setTimeout(() => process.exit(130), 5000).unref();
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  console.log('HNC Social Render');
  console.log('');
  console.log(whatLine);
  console.log(matchupLine);
  console.log(`Resolution: ${width}x${height}`);
  console.log(`FPS: ${fps}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Frames: ${totalFrames}`);
  console.log('');

  try {
    console.log('Rendering frames...');
    const session = trl !== null
      ? await SocialRenderSession.openTrailer(trl)
      : tpl !== null
        ? await SocialRenderSession.openTemplate(tpl)
        : await SocialRenderSession.open(compiled!);
    state.session = session;
    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        await session.screenshotFrame(frame, path.join(framesDir, frameFilename(frame)));
        if ((frame + 1) % 30 === 0 || frame + 1 === totalFrames) {
          console.log(`${frame + 1}/${totalFrames}`);
        }
      }
    } finally {
      state.session = undefined;
      await session.close();
    }
    console.log('');
    console.log('Rendering audio...');
    console.log(`Audio events: ${audioPlan.events.length} (crowd: ${crowdMode})`);
    if (audioPlanDebug) {
      console.log('Audio plan:');
      for (const e of [...audioPlan.events].sort((a, b) => a.time - b.time)) {
        console.log(`  ${e.time.toFixed(2)} ${e.type} dur=${e.duration.toFixed(2)} int=${e.intensity.toFixed(2)}${e.pan !== undefined ? ` pan=${e.pan.toFixed(2)}` : ''} ${e.assetId ?? '(procedural)'}`);
      }
      for (const d of [...(audioPlan.ducks ?? [])].sort((a, b) => a.start - b.start)) {
        console.log(`  duck ${d.bus} ${d.start.toFixed(2)}→${d.end.toFixed(2)} -${d.depthDb}dB`);
      }
    }
    if (monoLegacy) {
      writeFileSync(sfxPath, renderAudioToWav(audioPlan, seed));
    } else {
      const mix = renderStereoMix(audioPlan, seed, { stems, crowdMode });
      if (mix.warnings) for (const w of mix.warnings) console.warn(`audio fallback: ${w}`);
      writeFileSync(sfxPath, encodeStereoWav(mix));
      if (stems) {
        const { writeFileSync: writeStem } = await import('node:fs');
        void writeStem;
        const stemsOut = mix.stems;
        if (stemsOut) {
          const { encodeStereoWav: enc } = await import('../src/audio/mix');
          writeFileSync(path.join(framesDir, 'stem-ambience.wav'), enc({ sampleRate: mix.sampleRate, ...stemsOut.ambience }));
          writeFileSync(path.join(framesDir, 'stem-crowd.wav'), enc({ sampleRate: mix.sampleRate, ...stemsOut.crowd }));
          writeFileSync(path.join(framesDir, 'stem-sfx.wav'), enc({ sampleRate: mix.sampleRate, ...stemsOut.sfx }));
          writeFileSync(path.join(framesDir, 'stem-music.wav'), enc({ sampleRate: mix.sampleRate, ...stemsOut.music }));
          writeFileSync(path.join(framesDir, 'stem-master.wav'), encodeStereoWav(mix));
          console.log('Stems: stem-ambience.wav stem-crowd.wav stem-sfx.wav stem-music.wav stem-master.wav');
        }
      }
    }
    console.log('');

    console.log('Encoding H.264/AAC...');
    const encodeArgs = buildEncodeArgs({
      fps,
      framePattern: path.join(framesDir, '%06d.png'),
      audioPath: sfxPath,
      ...(musicPath !== undefined ? { musicPath, musicVolume } : {}),
      output: path.resolve(output),
    });
    mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    const { child, done } = runFfmpeg(ffmpeg, encodeArgs);
    state.ffmpeg = child;
    const result = await done;
    state.ffmpeg = undefined;
    if (result.status !== 0) {
      const tail = result.stderr.split('\n').slice(-15).join('\n');
      fail(`FFmpeg exited with status ${result.status}${result.signal ? ` (signal ${result.signal})` : ''}:\n${tail}`, framesDir);
    }
    console.log('');

    let probed: ProbedMedia;
    try {
      probed = await probeMedia(resolveFfprobe(), path.resolve(output));
    } catch {
      probed = await probeViaFfmpeg(ffmpeg, path.resolve(output));
    }
    try {
      validateMedia(probed, {
        width,
        height,
        fps,
        duration,
      });
    } catch (error) {
      fail(error instanceof ProbeError ? error.message : String(error), framesDir);
    }
    if (!(await hasFaststart(path.resolve(output)))) {
      fail('Output validation failed:\n- moov atom is not before mdata (faststart missing)', framesDir);
    }

    if (!keepFrames) {
      await rm(framesDir, { recursive: true, force: true });
    }
    state.done = true;
    console.log('Validated:');
    console.log(`${probed.width}x${probed.height}`);
    console.log(`${probed.fps.toFixed(2)} fps`);
    console.log(`${probed.duration.toFixed(2)} sec`);
    console.log(`${probed.codecVideo} + ${probed.codecAudio}`);
    console.log('');
    console.log('Wrote:');
    console.log(output);
    if (keepFrames) {
      console.log('');
      console.log('Frames kept at:');
      console.log(framesDir);
    }
  } catch (error) {
    if (process.exitCode === 1) throw error;
    fail(error instanceof Error ? error.message : String(error), framesDir);
  }
}

void main();
