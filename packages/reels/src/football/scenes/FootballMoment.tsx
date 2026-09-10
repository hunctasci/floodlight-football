import React from 'react';
import { FootballScene3D } from '../../stages/football/FootballStage';

/**
 * Reusable football sequences. Stories pass `type` + countries;
 * choreography/camera math stays inside the football domain.
 */
export const FootballMoment: React.FC<{
  type?: string;
  frame: number;
  fps: number;
  home: string;
  away: string;
  attackingTeam?: 'home' | 'away';
  shotStartFrame: number;
  durationInFrames: number;
}> = ({ type = 'attack-goal', frame, fps, home, away, attackingTeam, shotStartFrame, durationInFrames }) => (
  <FootballScene3D
    frame={frame}
    fps={fps}
    moment={type}
    home={home}
    away={away}
    attackingTeam={attackingTeam}
    shotStartFrame={shotStartFrame}
    durationInFrames={durationInFrames}
  />
);
