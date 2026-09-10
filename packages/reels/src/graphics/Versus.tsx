import React from 'react';
import { countryColors, countryFlag, countryName } from '../football/data/countries';

export const Versus: React.FC<{ home: string; away: string }> = ({ home, away }) => {
  const h = countryColors(home);
  const a = countryColors(away);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 780, display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 20, overflow: 'hidden', border: '4px solid #fff', boxShadow: '0 14px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ backgroundColor: h.primary, padding: '18px 30px', textAlign: 'center', minWidth: 300 }}>
          <div style={{ fontSize: 72 }}>{countryFlag(home)}</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#fff', textShadow: '0 3px 0 rgba(0,0,0,0.6)' }}>{countryName(home).toUpperCase()}</div>
        </div>
        <div style={{ backgroundColor: '#101b31', color: '#f8cc54', fontSize: 52, fontWeight: 900, display: 'flex', alignItems: 'center', padding: '0 22px', fontStyle: 'italic' }}>VS</div>
        <div style={{ backgroundColor: a.primary, padding: '18px 30px', textAlign: 'center', minWidth: 300 }}>
          <div style={{ fontSize: 72 }}>{countryFlag(away)}</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#fff', textShadow: '0 3px 0 rgba(0,0,0,0.6)' }}>{countryName(away).toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
};

export const GoalBanner: React.FC<{ home: string; scoringTeam?: string }> = ({ home, scoringTeam }) => {
  const team = scoringTeam ?? home;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 420, display: 'flex', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#e30a17', border: '4px solid #fff', padding: '14px 44px', transform: 'rotate(-3deg)', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
        <div style={{ fontFamily: "Impact, 'Arial Black', sans-serif", fontSize: 74, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>
          {countryName(team).toUpperCase()} SCORES!
        </div>
      </div>
    </div>
  );
};
