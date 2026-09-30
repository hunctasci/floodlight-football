import type { HncPlayerVisual } from './types.ts';

/**
 * Body proportions for non-adult HNC characters (the Player Diaries family).
 *
 * The child is the SAME canonical build (same primitives, materials, flat
 * shading, head/hair/eye layout) re-proportioned with part transforms only:
 * a relatively larger head, a shorter torso and shorter, slightly thicker
 * limbs. Scaling the whole adult to ~60% reads as a small adult; this reads
 * as a child while staying in the HNC language. Geometry is never rebuilt.
 *
 * Every number is derived from the adult layout in create-player.ts
 * (body 0.595–1.445, head r 0.32 @ 1.7, limbs 0.67 long) so the child keeps
 * the same overlaps (head sinks into the torso, shorts over the hips,
 * boots just touching the ground).
 */
export type HncProportionsId = 'adult' | 'child';

interface PartScale {
  /** Scale of the torso stack (body, stripe, number, shorts): radial, vertical. */
  torso: [number, number];
  /** Uniform head scale (hair + eyes ride on the head). */
  head: number;
  /** Limb scale: radial, length. */
  limb: [number, number];
  /** Uniform boot scale in world terms (the leg's scale is compensated). */
  boot: number;
}

const CHILD: PartScale = { torso: [0.62, 0.55], head: 0.84, limb: [0.68, 0.53], boot: 0.8 };

// Adult reference layout (create-player.ts).
const BODY_BOTTOM = 0.595;
const BODY_H = 0.85;
const STRIPE_BELOW_TOP = 1.445 - 1.28;
const NUMBER_ABOVE_CENTRE = 1.04 - 1.02;
const HEAD_R = 0.32;
const HEAD_SINK = 1.445 + HEAD_R - 1.7; // how far the head overlaps the torso top
const LIMB_HALF = 0.335;
const BOOT_DROP = -0.33;
const BOOT_HALF_H = 0.06;
const BOOT_Z = 0.07;

/**
 * Re-proportion a canonical visual in place. `adult` is a no-op (the
 * canonical layout). Deterministic and idempotent for a freshly created
 * visual; call it once, right after createHncPlayerVisual().
 */
export function applyHncProportions(visual: HncPlayerVisual, id: HncProportionsId): void {
  if (id === 'adult') return;
  const p = CHILD;
  const [tr, ty] = p.torso;
  const [lr, ll] = p.limb;
  const stripe = visual.trimParts[3];
  const shorts = visual.trimParts[2];
  const number = visual.root.children.find(
    (c) => (c as THREE_Mesh).isMesh && (c as THREE_Mesh).geometry?.type === 'PlaneGeometry',
  );

  // Legs: boots land where the adult boots land (bottom ~1 cm below ground).
  const legHalf = LIMB_HALF * ll;
  const bootHalf = BOOT_HALF_H * p.boot;
  const legCentre = BOOT_DROP * ll * -1 + bootHalf - 0.01;
  const hip = legCentre + legHalf;
  for (const [leg, side] of [[visual.legL, -1], [visual.legR, 1]] as const) {
    leg.scale.set(lr, ll, lr);
    leg.position.set(side * 0.2 * tr * 1.05, legCentre, 0);
    const boot = leg.children[0];
    boot.scale.set(p.boot / lr, p.boot / ll, p.boot / lr);
    boot.position.set(0, BOOT_DROP, (BOOT_Z * p.boot) / lr);
  }

  // Torso stack keeps the adult overlaps: body bottom sits the same share below the hip.
  const bodyH = BODY_H * ty;
  const bodyBottom = hip - (0.715 - BODY_BOTTOM) * ty;
  const bodyCentre = bodyBottom + bodyH / 2;
  const bodyTop = bodyBottom + bodyH;
  visual.body.scale.set(tr, ty, tr);
  visual.body.position.y = bodyCentre;
  stripe.scale.set(tr, ty, tr);
  stripe.position.y = bodyTop - STRIPE_BELOW_TOP * ty;
  shorts.scale.set(tr, ty * 1.1, tr);
  shorts.position.y = hip - (0.715 - 0.68) * ty;
  if (number) {
    number.scale.set(tr, tr, 1);
    number.position.set(0, bodyCentre + NUMBER_ABOVE_CENTRE * ty, -0.44 * tr - 0.004);
  }

  // Head: relatively larger, sinking into the torso like the adult's.
  visual.head.scale.setScalar(p.head);
  visual.head.position.y = bodyTop + HEAD_R * p.head - HEAD_SINK * p.head;

  // Arms hang from just under the torso top, hugging the narrower body.
  const armHalf = LIMB_HALF * ll;
  const shoulder = bodyTop - 0.03 * ty;
  for (const [arm, side] of [[visual.armL, -1], [visual.armR, 1]] as const) {
    arm.scale.set(lr, ll, lr);
    arm.position.set(side * (0.48 * tr + 0.03), shoulder - armHalf, 0);
  }
}

// Structural typing for the one mesh check above (keeps this file free of a runtime THREE import).
interface THREE_Mesh {
  isMesh?: boolean;
  geometry?: { type?: string };
}
