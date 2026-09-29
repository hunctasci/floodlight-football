import * as THREE from 'three';
import type { HncPlayerVisual, HncWardrobeId } from './types.ts';

/**
 * Colour token resolved per character: `__kit__` / `__trim__` = country kit
 * primary / secondary, `__accent__` = the character's accent (defaults to the
 * kit primary). Lets one wardrobe carry every country's clue colour.
 */
type Swatch = string;

export interface HncWardrobeSpec {
  /** Shirt / torso colour. */
  shirt: Swatch;
  /** Leg / trouser colour (replaces trim on legs+shorts for office). */
  trousers: Swatch;
  /** Optional tie colour (small chest box). */
  tie?: Swatch;
  /** Optional blazer tint (thin shell over the torso). */
  jacket?: Swatch;
  /** Optional chest badge colour (small plane). */
  badge?: Swatch;
  /** Kit-striped scarf around the neck (supporters). */
  scarf?: boolean;
  /** Broadcast headset on the head (turns with it). */
  headset?: boolean;
  /** Hood bunched behind the neck. */
  hood?: Swatch;
  /** Hide the football chest stripe + back number (office has no kit). */
  hideKitMarkings?: boolean;
  /** Keep the chest stripe but hide the back number (replica shirts). */
  hideNumber?: boolean;
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
    tie: '__accent__',
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
  suit: { shirt: '#f3ede0', trousers: '#1c2333', tie: '__accent__', jacket: '#1b2a44', hideKitMarkings: true },
  commentator: { shirt: '#f3ede0', trousers: '#1c2333', tie: '__accent__', jacket: '#2a2f3d', headset: true, hideKitMarkings: true },
  fan: { shirt: '__kit__', trousers: '#34435a', scarf: true, hideNumber: true },
  referee: { shirt: '#1d1f27', trousers: '#15161c', badge: '#f7bf30', hideKitMarkings: true },
  hoodie: { shirt: '__accent__', trousers: '#2f3a4c', hood: '__accent__', hideKitMarkings: true },
  /** At home: plain tee in the accent colour, jeans. */
  tee: { shirt: '__accent__', trousers: '#34435a', hideKitMarkings: true },
  /** Halfway through a change: the country shirt (number on the back) over office trousers. */
  'kit-trousers': { shirt: '__kit__', trousers: '#23283b' },
};

export interface HncWardrobeColors {
  primary: string;
  secondary: string;
  /** Personal clue colour (tie, hoodie). Defaults to `primary`. */
  accent?: string;
  /** Optional printed badge (e.g. a national-flag ID card); replaces the badge colour. */
  badgeMap?: THREE.Texture;
}

function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose?.();
      (m.material as THREE.Material | undefined)?.dispose?.();
    }
  });
}

/**
 * Apply a wardrobe to an existing canonical visual. Football wardrobes keep
 * the kit markings. Office/supporter wardrobes recolour torso + legs, hide the
 * stripe/number as specified, and add tie/jacket/badge/scarf/headset meshes
 * in the HNC chunky flat-shaded language.
 *
 * Deterministic + idempotent: calling twice with the same wardrobe rebuilds
 * the same extras (old extras are removed + disposed).
 */
export function applyHncWardrobe(
  visual: HncPlayerVisual,
  wardrobe: HncWardrobeId | HncWardrobeSpec,
  kit?: HncWardrobeColors,
): void {
  const spec: HncWardrobeSpec = typeof wardrobe === 'string' ? HNC_WARDROBES[wardrobe] : wardrobe;

  for (const e of visual.extras) {
    e.parent?.remove(e);
    disposeTree(e);
  }
  visual.extras.length = 0;

  const swatch = (s: Swatch): string => {
    if (s === '__kit__') return kit?.primary ?? '#ffffff';
    if (s === '__trim__') return kit?.secondary ?? '#151515';
    if (s === '__accent__') return kit?.accent ?? kit?.primary ?? '#b03030';
    return s;
  };

  for (const m of visual.kitParts) (m.material as THREE.MeshStandardMaterial).color.set(swatch(spec.shirt));
  for (const m of visual.trimParts) (m.material as THREE.MeshStandardMaterial).color.set(swatch(spec.trousers));

  // Footballers keep stripe + number visible; office hides them.
  const stripe = visual.trimParts[3];
  const numberMesh = visual.root.children.find(
    (c) => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry?.type === 'PlaneGeometry',
  );
  if (stripe) {
    stripe.visible = !spec.hideKitMarkings;
    // Replica shirts keep the stripe in the kit trim, not the trouser colour.
    if (spec.hideNumber) (stripe.material as THREE.MeshStandardMaterial).color.set(swatch('__trim__'));
  }
  if (numberMesh) numberMesh.visible = !spec.hideKitMarkings && !spec.hideNumber;

  const flat = (color: string, roughness = 0.9): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
  const add = (obj: THREE.Object3D, parent: THREE.Object3D = visual.root): void => {
    parent.add(obj);
    visual.extras.push(obj);
  };

  if (spec.jacket) {
    // Blazer shell: slightly wider short cylinder over the torso.
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.62, 6), flat(swatch(spec.jacket)));
    jacket.position.y = 1.1;
    add(jacket);
  }
  if (spec.tie) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.04), flat(swatch(spec.tie), 0.7));
    tie.position.set(0, 1.08, spec.jacket ? 0.46 : 0.4);
    tie.rotation.x = 0.06;
    add(tie);
  }
  if (spec.badge) {
    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.14),
      kit?.badgeMap ? new THREE.MeshBasicMaterial({ map: kit.badgeMap }) : new THREE.MeshBasicMaterial({ color: swatch(spec.badge) }),
    );
    badge.position.set(spec.jacket ? -0.22 : 0.16, 1.22, spec.jacket ? 0.47 : 0.42);
    badge.rotation.x = -0.06;
    add(badge);
  }
  if (spec.scarf) {
    // Chunky ring + hanging tail in the two kit colours.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 5, 8), flat(swatch('__kit__')));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.44;
    add(ring);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.05), flat(swatch('__trim__')));
    tail.position.set(0.14, 1.2, 0.42);
    tail.rotation.set(0.08, 0, -0.08);
    add(tail);
  }
  if (spec.hood) {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.1, 5, 8, Math.PI * 1.3), flat(swatch(spec.hood)));
    hood.rotation.set(Math.PI / 2, 0, Math.PI * 0.85);
    hood.position.set(0, 1.46, -0.06);
    add(hood);
  }
  if (spec.headset) {
    // On the head so it turns with it: band, ear cup, mic boom.
    const dark = flat('#1a1d26', 0.6);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 4, 10, Math.PI), dark);
    band.rotation.y = Math.PI / 2;
    band.position.y = 0.02;
    add(band, visual.head);
    const cup = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.14), dark);
    cup.position.set(-0.33, 0, 0);
    add(cup, visual.head);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.26), dark);
    boom.position.set(-0.3, -0.1, 0.15);
    boom.rotation.y = -0.35;
    add(boom, visual.head);
  }
}

export type HncHeldProp = 'mug' | 'phone' | 'yellow-card' | 'red-card' | 'microphone' | 'paper-cup' | 'espresso' | 'remote' | 'scarf';

export const HNC_HELD_PROPS: readonly HncHeldProp[] = ['mug', 'phone', 'yellow-card', 'red-card', 'microphone', 'paper-cup', 'espresso', 'remote', 'scarf'];

/**
 * Put a small prop in the right hand (bottom end of the right arm stick, so
 * it follows every arm pose). One held prop at a time; `null` clears it.
 */
export function setHncHeldProp(visual: HncPlayerVisual, prop: HncHeldProp | null, color = '#f3ede0'): void {
  const existing = visual.armR.getObjectByName('hnc-held');
  if (existing) {
    visual.armR.remove(existing);
    disposeTree(existing);
  }
  if (!prop) return;
  const flat = (c: string, roughness = 0.8): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness, flatShading: true });
  const group = new THREE.Group();
  group.name = 'hnc-held';
  group.position.set(0, -0.38, 0.08);
  if (prop === 'mug') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.17, 7), flat(color));
    cup.position.z = 0.06;
    group.add(cup);
  } else if (prop === 'phone') {
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.19, 0.025), flat('#161a24', 0.4));
    phone.position.z = 0.05;
    group.add(phone);
  } else if (prop === 'paper-cup') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.2, 8), flat('#b89572'));
    cup.position.z = 0.06;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.068, 0.08, 8), flat('#e9e1d2'));
    sleeve.position.set(0, -0.01, 0.06);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.079, 0.079, 0.025, 8), flat('#fbf8f2'));
    lid.position.set(0, 0.11, 0.06);
    group.add(cup, sleeve, lid);
  } else if (prop === 'espresso') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.075, 8), flat('#fbf8f2', 0.5));
    cup.position.z = 0.06;
    group.add(cup);
  } else if (prop === 'remote') {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.03), flat('#1d212b', 0.5));
    r.position.z = 0.05;
    group.add(r);
  } else if (prop === 'scarf') {
    // A folded supporter scarf: two stacked kit-coloured slabs.
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), flat(color));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.16), flat('#f3ede0'));
    a.position.set(0, -0.02, 0.12);
    b.position.set(0, 0.025, 0.12);
    group.add(a, b);
  } else if (prop === 'microphone') {
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.24, 6), flat('#1a1d26', 0.5));
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), flat('#3b4150', 0.5));
    head.position.y = -0.14;
    mic.add(head);
    group.add(mic);
  } else {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.012), new THREE.MeshBasicMaterial({ color: prop === 'red-card' ? '#d92b2b' : '#f7d330' }));
    card.position.set(0, -0.08, 0.04);
    group.add(card);
  }
  visual.armR.add(group);
}
