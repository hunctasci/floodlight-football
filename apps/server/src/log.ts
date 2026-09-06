import { pino } from 'pino';

export function createLogger(level: string) {
  return pino({
    level,
    base: { service: 'retro-server' },
    formatters: { level: (label: string) => ({ level: label }) },
  });
}

export type Logger = ReturnType<typeof createLogger>;
