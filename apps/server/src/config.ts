export interface ServerConfig {
  port: number;
  redisUrl: string | null;
  databaseUrl: string | null;
  roomTtlSec: number;
  createPerMin: number;
  joinPerMin: number;
  signalPerMin: number;
  leaguePerMin: number;
  maxPayloadBytes: number;
  logLevel: string;
  clientOrigin: string;
}

const num = (v: string | undefined, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: num(env.PORT, 8080),
    redisUrl: env.REDIS_URL?.trim() ? env.REDIS_URL.trim() : null,
    databaseUrl: env.DATABASE_URL?.trim() ? env.DATABASE_URL.trim() : null,
    roomTtlSec: num(env.ROOM_TTL_SEC, 7200),
    createPerMin: num(env.RATE_CREATE_PER_MIN, 5),
    joinPerMin: num(env.RATE_JOIN_PER_MIN, 20),
    signalPerMin: num(env.RATE_SIGNAL_PER_MIN, 240),
    leaguePerMin: num(env.RATE_LEAGUE_PER_MIN, 10),
    maxPayloadBytes: num(env.MAX_PAYLOAD_BYTES, 65536),
    logLevel: env.LOG_LEVEL?.trim() || 'info',
    clientOrigin: env.CLIENT_ORIGIN?.trim() || '*',
  };
}
