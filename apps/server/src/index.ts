import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { MemoryStore } from './store.js';
import { RedisStore } from './redis-store.js';
import { MemoryLeagueStore, type LeagueStore } from './leagues/store.js';
import { createPgLeagueStore, runMigrations } from './db/pg-leagues.js';
import { createApp } from './server.js';

const config = loadConfig();
const log = createLogger(config.logLevel);

let store;
let redisUp: () => boolean | Promise<boolean> = () => false;
if (config.redisUrl) {
  const redis = new RedisStore(config.redisUrl);
  store = redis;
  redisUp = () => redis.ping();
  log.info('using Redis store');
} else {
  store = new MemoryStore();
  log.warn('REDIS_URL unset: ephemeral memory store (rooms vanish on restart)');
}

// Leagues are durable: Postgres when configured, memory otherwise (dev/tests).
let leagues: LeagueStore = new MemoryLeagueStore();
let closeDb: (() => Promise<void>) | null = null;
if (config.databaseUrl) {
  try {
    const { store: pg, sql } = createPgLeagueStore(config.databaseUrl);
    await runMigrations(sql);
    leagues = pg;
    closeDb = () => sql.end();
    log.info('using Postgres league store');
  } catch (e) {
    log.error({ err: e }, 'Postgres unavailable, falling back to memory leagues');
  }
} else {
  log.warn('DATABASE_URL unset: memory league store (leagues vanish on restart)');
}

const app = createApp(store, config, log, redisUp, leagues);
app.http.listen(config.port, () => {
  log.info({ port: config.port }, 'retro-server listening');
});

const shutdown = () => {
  log.info('shutting down');
  void app.close().finally(() => (closeDb ? closeDb().finally(() => process.exit(0)) : process.exit(0)));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
