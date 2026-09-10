import { getAnimation } from '../animation/animation-registry';

export const ACTOR_MODEL_IDS = [
  'office-worker-male-01',
  'office-worker-male-02',
  'office-worker-female-01',
  'office-worker-female-02',
  'hnc-footballer',
  'procedural-office-worker',
  'procedural-hnc-footballer',
] as const;

export function resolveActorModel(model: string): string {
  if ((ACTOR_MODEL_IDS as readonly string[]).includes(model)) return model;
  // Unknown third-party ids fail loudly instead of silently rendering wrong.
  throw new Error(`Unknown actor model: ${model}`);
}

export function resolveActorAnimation(animation: string | undefined, fallback = 'idle'): string {
  if (!animation) return fallback;
  return getAnimation(animation).id;
}
