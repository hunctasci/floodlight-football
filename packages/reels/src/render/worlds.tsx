/**
 * World id → scene component (render half of the world registry).
 * 3D scenes render inside the shot's ThreeCanvas; 2D scenes are DOM.
 */
import type React from 'react';
import type { Shot, Timeline } from '../engine/timeline/types';
import type { Lens } from '../worlds/types';
import { BreakroomScene } from '../worlds/breakroom/BreakroomScene';
import { FootballScene } from '../worlds/football/FootballScene';
import { OfficeScene } from '../worlds/office/OfficeScene';
import { PhoneScene } from '../worlds/phone/PhoneScene';
import { StudioScene } from '../worlds/studio/StudioScene';
import { TitleScene } from '../worlds/title/TitleScene';

export interface SceneProps {
  shot: Shot;
  frame: number;
  fps: number;
  timeline: Timeline;
  /** The shot camera (3D worlds) — lets cast look into the lens. */
  lens?: Lens;
}

export const SCENES_3D: Record<string, React.FC<SceneProps>> = {
  football: FootballScene,
  office: OfficeScene,
  studio: StudioScene,
  breakroom: BreakroomScene,
};

export const SCENES_2D: Record<string, React.FC<SceneProps>> = {
  phone: PhoneScene,
  title: TitleScene,
};
