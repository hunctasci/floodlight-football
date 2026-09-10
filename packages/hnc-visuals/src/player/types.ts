import type * as THREE from 'three';

/** Canonical HNC player visual handles. Root + animated parts + kit groups. */
export interface HncPlayerVisual {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  /** Player blob shadow (mounted separately in world space, like the game). */
  shadow: THREE.Mesh;
  kit: THREE.Color;
  trim: THREE.Color;
  keeper: boolean;
  kitParts: THREE.Mesh[];
  trimParts: THREE.Mesh[];
  /** Extra wardrobe meshes (tie, badge, jacket...) — empty for footballers. */
  extras: THREE.Object3D[];
}

export interface CreateHncPlayerOptions {
  /** Stable player index — drives the skin palette (id % 4). */
  id: number;
  /** Shirt number 1..11 (back number texture). */
  number: number;
  /** Shirt colour. */
  primary: string;
  /** Trim colour (stripe / shorts / legs). */
  secondary: string;
  keeper?: boolean;
}

/** Exact game skin palette, indexed by id % 4. */
export const HNC_SKIN_PALETTE = ['#f0b68c', '#985c3c', '#d78f65', '#6d422f'] as const;

/** Keeper shirt colour (game constant). */
export const HNC_KEEPER_COLOR = '#6b64d9';

/** Wardrobe variants sharing the same HNC body/head/face/proportion language. */
export type HncWardrobeId =
  | 'footballer'
  | 'goalkeeper'
  | 'office-worker'
  | 'office-worker-formal'
  | 'office-worker-casual'
  | 'manager';
