/**
 * Backwards-compatibility shim: league domain split into leagues/store.ts
 * (durable LeagueStore + memory adapter) and leagues/service.ts (manager +
 * pure round-robin/standings). New code imports from those directly.
 */
export * from './leagues/store.js';
export * from './leagues/service.js';
