export const STAGE_IDS = ['office', 'stadium', 'graphics', 'generic'] as const;

export type StageId = (typeof STAGE_IDS)[number];

export interface StageAnchor {
  id: string;
  /** Procedural world position for placeholder stages. Real GLBs override. */
  pos: [number, number, number];
  rotY?: number;
}

export const OFFICE_ANCHORS: StageAnchor[] = [
  { id: 'desk-left', pos: [-2.0, 0, 0], rotY: 0.3 },
  { id: 'desk-right', pos: [2.0, 0, 0], rotY: -0.3 },
  { id: 'manager', pos: [0, 0, -3.2], rotY: Math.PI },
  { id: 'coffee-machine', pos: [4.2, 0, -2.0] },
  { id: 'meeting-table', pos: [-4.1, 0, 2.4] },
  { id: 'door', pos: [-4.5, 0, -2.5] },
  { id: 'window', pos: [0, 1.8, -4.2] },
  { id: 'camera-wide', pos: [0, 3.2, 7.5] },
  { id: 'camera-desk-left', pos: [-1.7, 1.6, 2.2] },
  { id: 'camera-desk-right', pos: [1.9, 1.7, 1.8] },
];

export const FOOTBALL_ANCHORS: StageAnchor[] = [
  { id: 'faceoff-home', pos: [-1.2, 0, 0], rotY: Math.PI / 2 },
  { id: 'faceoff-away', pos: [1.2, 0, 0], rotY: -Math.PI / 2 },
  { id: 'penalty-home', pos: [-20, 0, 0] },
  { id: 'goal-home', pos: [-46, 0, 0] },
  { id: 'goal-away', pos: [46, 0, 0] },
  { id: 'center', pos: [0, 0, 0] },
];

export function getStageAnchors(stageId: string): StageAnchor[] {
  if (stageId === 'office') return OFFICE_ANCHORS;
  if (stageId === 'stadium') return FOOTBALL_ANCHORS;
  return [{ id: 'center', pos: [0, 0, 0] }];
}

export function resolveAnchor(stageId: string, anchorId: string): StageAnchor {
  const anchors = getStageAnchors(stageId);
  const found = anchors.find((a) => a.id === anchorId);
  if (!found) throw new Error(`Unknown anchor "${anchorId}" for stage "${stageId}"`);
  return found;
}
