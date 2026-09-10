import { existsSync } from 'node:fs';
import path from 'node:path';

/** Failure when no FFmpeg (or ffprobe) executable can be found. */
export class EncoderNotFoundError extends Error {}

/**
 * Resolve an executable: explicit env var first, then PATH lookup. Pure
 * filesystem probing — no shell, so user values can never inject commands.
 * `env` and `pathValue` are injectable for tests.
 */
export function resolveExecutable(
  envVar: string,
  binary: string,
  env: NodeJS.ProcessEnv = process.env,
  pathValue: string = process.env.PATH ?? '',
): string {
  const explicit = env[envVar];
  if (typeof explicit === 'string' && explicit.length > 0) {
    if (existsSync(explicit)) return explicit;
    throw new EncoderNotFoundError(
      `${envVar} is set to "${explicit}", but that file does not exist.`,
    );
  }
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, binary);
    if (existsSync(candidate)) return candidate;
  }
  throw new EncoderNotFoundError(
    `${binary} was not found.\n\nInstall FFmpeg or set ${envVar} to the executable path.`,
  );
}

export function resolveFfmpeg(
  env: NodeJS.ProcessEnv = process.env,
  pathValue: string = process.env.PATH ?? '',
): string {
  return resolveExecutable('FFMPEG_PATH', 'ffmpeg', env, pathValue);
}

export function resolveFfprobe(
  env: NodeJS.ProcessEnv = process.env,
  pathValue: string = process.env.PATH ?? '',
): string {
  return resolveExecutable('FFPROBE_PATH', 'ffprobe', env, pathValue);
}
