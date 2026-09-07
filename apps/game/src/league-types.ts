/** Structural mirror of the @floodlight/protocol league DTOs (game stays decoupled). */
export interface LeagueMember {
  clientId: string;
  displayName: string;
  joinedAt: number;
}

export type FixtureStatus = 'pending' | 'confirmed' | 'disputed';

export interface Fixture {
  id: string;
  round: number;
  homeClientId: string;
  awayClientId: string;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
}

export interface StandingsRow {
  clientId: string;
  displayName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface League {
  id: string;
  name: string;
  code: string;
  status: 'lobby' | 'active' | 'done';
  createdBy: string;
  createdAt: number;
  members: LeagueMember[];
  fixtures: Fixture[];
  standings: StandingsRow[];
}
