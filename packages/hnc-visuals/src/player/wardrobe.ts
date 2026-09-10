import * as THREE from 'three';
import type { HncPlayerVisual, HncWardrobeId } from './types.ts';

export interface HncWardrobeSpec {
  /** Shirt / torso colour. */
  shirt: string;
  /** Leg / trouser colour (replaces trim on legs+shorts for office). */
  trousers: string;
  /** Optional tie colour (small chest box). */
  tie?: string;
  /** Optional blazer tint (thin shell over the torso). */
  jacket?: string;
  /** Optional chest badge colour (small plane). */
  badge?: string;
  /** Hide the football chest stripe + back number (office has no kit). */
  hideKitMarkings?: boolean;
}

/**
 * Wardrobe palette. The BASE character (proportions, head, hair, eyes,
 * limbs, boots) is ALWAYS the canonical HNC footballer — only materials and
 * small accessories change. The comedy of office → football comes from the
 * SAME character changing context/wardrobe.
 */
export const HNC_WARDROBES: Record<HncWardrobeId, HncWardrobeSpec> = {
  footballer: { shirt: '__kit__', trousers: '__trim__' },
  goalkeeper: { shirt: '#6b64d9', trousers: '#28283b' },
  'office-worker': {
    shirt: '#e8e4da',
    trousers: '#23283b',
    tie: '#b03030',
    badge: '#2b4a6f',
    hideKitMarkings: true,
  },
  'office-worker-formal': {
    shirt: '#f3ede0',
    trousers: '#1c2333',
    tie: '#182747',
    jacket: '#2b4a6f',
    badge: '#c8a83c',
    hideKitMarkings: true,
  },
  'office-worker-casual': {
    shirt: '#5fcddd',
    trousers: '#3a4350',
    badge: '#ffffff',
    hideKitMarkings: true,
  },
  manager: {
    shirt: '#f3ede0',
    trousers: '#1c2333',
    tie: '#0d5eaf',
    jacket: '#101b31',
    badge: '#f8cc54',
    hideKitMarkings: true,
  },
};

/**
 * Apply a wardrobe to an existing canonical visual. Football wardrobes are
 * no-ops (kit colours already correct). Office wardrobes recolour torso +
 * legs, hide the stripe/number, and add tie/jacket/badge meshes that reuse
 * the HNC chunky flat-shaded language.
 *
 * Deterministic + idempotent: calling twice with the same wardrobe rebuilds
 * the same extras (old extras are removed + disposed).
 */
export function applyHncWardrobe(
  visual: HncPlayerVisual,
  wardrobe: HncWardrobeId | HncWardrobeSpec,
  kit?: { primary: string; secondary: string },
): void {
  const spec: HncWardrobeSpec =
    typeof wardrobe === 'string' ? HNC_WARDROBES[wardrobe] : wardrobe;

  // Clear previous extras.
  for (const e of visual.extras) {
    visual.root.remove(e);
    e.traverse?.((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if ((m as THREE.Mesh).isMesh) {
        (m as THREE.Mesh).geometry?.dispose?.();
        const mat = (m as THREE.Mesh).material as THREE.Material | undefined;
        mat?.dispose?.();
      }
    });
  }
  visual.extras.length = 0;

  const shirtColor =
    spec.shirt === '__kit__' ? (kit?.primary ?? '#ffffff') : spec.shirt;
  const trouserColor =
    spec.trousers === '__trim__' ? (kit?.secondary ?? '#151515') : spec.trousers;

  for (const m of visual.kitParts)
    (m.material as THREE.MeshStandardMaterial).color.set(shirtColor);
  for (const m of visual.trimParts)
    (m.material as THREE.MeshStandardMaterial).color.set(trouserColor);

  // Footballers keep stripe + number visible; office hides them.
  const stripe = visual.trimParts[3];
  const numberMesh = visual.root.children.find(
    (c) => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry?.type === 'PlaneGeometry',
  );
  if (stripe) stripe.visible = !spec.hideKitMarkings;
  if (numberMesh) numberMesh.visible = !spec.hideKitMarkings;

  const flat = (color: string, roughness = 0.9): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });

  if (spec.jacket) {
    // Blazer shell: slightly wider short cylinder over the torso.
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.62, 6), flat(spec.jacket));
    jacket.position.y = 1.1;
    visual.root.add(jacket);
    visual.extras.push(jacket);
  }
  if (spec.tie) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.04), flat(spec.tie, 0.7));
    tie.position.set(0, 1.08, 0.4);
    tie.rotation.x = 0.06;
    visual.root.add(tie);
    visual.extras.push(tie);
  }
  if (spec.badge) {
    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.14),
      new THREE.MeshBasicMaterial({ color: spec.badge }),
    );
    badge.position.set(spec.jacket ? -0.22 : 0.16, 1.22, spec.jacket ? 0.44 : 0.42);
    badge.rotation.y = 0;
    badge.rotation.x = -0.06;
    visual.root.add(badge);
    visual.extras.push(badge);
  }
}
