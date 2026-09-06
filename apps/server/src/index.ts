import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { MemoryStore } from './store.js';
import { RedisStore } from './redis-store.js';
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

const app = createApp(store, config, log, redisUp);
app.http.listen(config.port, () => {
  log.info({ port: config.port }, 'retro-server listening');
});

const shutdown = () => {
  log.info('shutting down');
  void app.close().finally(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
