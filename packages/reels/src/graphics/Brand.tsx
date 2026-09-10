import React from 'react';
import { HNC_BRAND } from '../football/data/branding';
import { countryColors, countryFlag } from '../football/data/countries';

export const Brand: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, backgroundColor: 'rgba(16,27,49,0.9)', padding: '12px 30px', borderRadius: 16, border: '2px solid #f8cc54' }}>
      <div style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: '#f8cc54', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 30, color: '#101b31' }}>H</div>
      <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>{HNC_BRAND.league}</div>
    </div>
    <div style={{ fontSize: 30, fontWeight: 700, color: '#f8efdb', letterSpacing: 2 }}>{HNC_BRAND.site}</div>
  </div>
);

export const BrandLockup = Brand;

export const Badge: React.FC<{ label: string; color?: string }> = ({ label, color = '#f8cc54' }) => (
  <div style={{ display: 'inline-block', backgroundColor: color, color: '#101b31', fontWeight: 900, fontSize: 32, padding: '8px 22px', borderRadius: 999, letterSpacing: 1 }}>
    {label}
  </div>
);

export const CountryFlag: React.FC<{ code: string; size?: number }> = ({ code, size = 72 }) => {
  const c = countryColors(code);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: size, lineHeight: 1 }}>{countryFlag(code)}</div>
      <div style={{ width: 18, height: size * 0.7, borderRadius: 6, backgroundColor: c.primary, border: '2px solid #fff' }} />
    </div>
  );
};
