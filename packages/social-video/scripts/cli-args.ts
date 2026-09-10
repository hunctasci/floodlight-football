import type { RawVideoInput } from '../src/schema';

/**
 * Minimal shared CLI parsing for the social-video scripts (frame, frames,
 * render). No framework: `--key value` / `--key=value` / boolean flags only.
 * Values arrive pre-split from the shell; everything downstream travels via
 * typed specs and spawn arg arrays (never shell strings).
 */

export function readArgs(argv: string[]): Map<string, string | true> {
  const out = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq >= 0) {
      out.set(token.slice(2, eq), token.slice(eq + 1));
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      out.set(token.slice(2), argv[++i]);
    } else {
      out.set(token.slice(2), true);
    }
  }
  return out;
}

export function argStr(args: Map<string, string | true>, name: string): string | undefined {
  const v = args.get(name);
  return typeof v === 'string' ? v : undefined;
}

export function argFlag(args: Map<string, string | true>, ...names: string[]): boolean {
  return names.some((n) => args.get(n) === true);
}

/**
 * Shared semantic spec options across frame/frames/render. Overlay copy and
 * layer flags behave identically everywhere.
 */
export function specInputFromArgs(args: Map<string, string | true>): RawVideoInput {
  return {
    scene: argStr(args, 'scene'),
    template: argStr(args, 'template'),
    trailer: argStr(args, 'trailer'),
    home: argStr(args, 'home'),
    away: argStr(args, 'away'),
    format: argStr(args, 'format'),
    seed: argStr(args, 'seed'),
    fps: argStr(args, 'fps'),
    duration: argStr(args, 'duration'),
    attackTeam: argStr(args, 'attack-team') ?? argStr(args, 'attackTeam'),
    attackStyle: argStr(args, 'attack-style') ?? argStr(args, 'attackStyle'),
    headline: argStr(args, 'headline'),
    secondary: argStr(args, 'secondary'),
    cta: argStr(args, 'cta'),
    overlays: argFlag(args, 'no-overlays', 'noOverlays') ? 'none' : argStr(args, 'overlays'),
  };
}

/** Trailer-only semantic input (no timecodes, no cameras — director-owned). */
export function trailerInputFromArgs(args: Map<string, string | true>): Record<string, unknown> {
  return {
    trailer: argStr(args, 'trailer'),
    countries: argStr(args, 'countries'),
    format: argStr(args, 'format'),
    seed: argStr(args, 'seed'),
    fps: argStr(args, 'fps'),
    attackTeam: argStr(args, 'attack-team') ?? argStr(args, 'attackTeam'),
    attackStyle: argStr(args, 'attack-style') ?? argStr(args, 'attackStyle'),
    overlays: argFlag(args, 'no-overlays', 'noOverlays') ? 'none' : argStr(args, 'overlays'),
  };
}

export function outputFromArgs(args: Map<string, string | true>): string | undefined {
  return argStr(args, 'output') ?? argStr(args, 'out');
}
