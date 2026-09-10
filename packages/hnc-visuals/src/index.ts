/**
 * Canonical HNC visual identity — single source of truth for players, ball,
 * stadium, crowd, rendering profile and cameras.
 *
 * - apps/game imports builders + profile (extraction refactor, identical look)
 * - packages/reels mounts them via thin R3F adapters (no JSX re-creation)
 * - future screenshot / social tools reuse the same primitives
 *
 * This package MUST NOT depend on React or Remotion (Three.js only).
 */
export * from './player/types.ts';
export * from './player/number-texture.ts';
export * from './player/create-player.ts';
export * from './player/pose-player.ts';
export * from './player/wardrobe.ts';
export * from './ball/ball-texture.ts';
export * from './ball/create-ball.ts';
export * from './stadium/constants.ts';
export * from './stadium/create-pitch.ts';
export * from './stadium/create-goals.ts';
export * from './stadium/create-stands.ts';
export * from './stadium/create-crowd.ts';
export * from './stadium/create-dressing.ts';
export * from './stadium/create-stadium.ts';
export * from './rendering/render-profile.ts';
export * from './cameras/social-cameras.ts';
