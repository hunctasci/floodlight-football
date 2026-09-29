/** Minimal `--name value` / `--name=value` / `--flag` parsing for the reels CLIs. */
export function arg(name: string, fallback?: string): string | undefined {
  const argv = process.argv;
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
