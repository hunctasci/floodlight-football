/**
 * Canvas painters for in-world screens and printed textures (monitors,
 * studio wall, desk flags, whiteboard, wall clock). Canvas → CanvasTexture,
 * so screens are part of the 3D world (lit, fogged, occluded by heads).
 * Every painter is a pure function of its inputs.
 */
import * as THREE from 'three';
import { countryColors, countryFlag, countryName } from '../cast/countries';
import { HNC_UI } from '../graphics/hnc-ui';

export interface ScreenData {
  home: string;
  away: string;
  /** Seconds (animated content). */
  t: number;
  ticker?: string;
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, d: ScreenData) => void;

const display = (px: number) => `${px}px Impact, 'Arial Black', sans-serif`;
const mono = (px: number, weight = 700) => `${weight} ${px}px ui-monospace, Menlo, monospace`;

const PAINTERS: Record<string, Painter> = {
  off: (c, w, h) => {
    c.fillStyle = '#0d1119';
    c.fillRect(0, 0, w, h);
  },
  spreadsheet: (c, w, h) => {
    c.fillStyle = '#eef2f5';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2f7d4f';
    c.fillRect(0, 0, w, h * 0.09);
    c.strokeStyle = '#c3ccd4';
    c.lineWidth = 2;
    for (let y = h * 0.16; y < h; y += h * 0.075) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let x = w * 0.18; x < w; x += w * 0.16) {
      c.beginPath();
      c.moveTo(x, h * 0.09);
      c.lineTo(x, h);
      c.stroke();
    }
    c.fillStyle = '#8b98a5';
    for (let r = 0; r < 10; r++) for (let k = 0; k < 5; k++) c.fillRect(w * (0.21 + k * 0.16), h * (0.19 + r * 0.075), w * 0.08 * (((r * 7 + k * 3) % 5) / 5 + 0.3), h * 0.022);
  },
  'hnc-logo': (c, w, h) => {
    c.fillStyle = HNC_UI.navy;
    c.fillRect(0, 0, w, h);
    c.fillStyle = HNC_UI.gold;
    c.font = display(h * 0.3);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('HNC LEAGUE', w / 2, h / 2);
  },
  'hnc-live': (c, w, h, d) => {
    // A match in progress: pitch, two dots of players, HUD scoreboard.
    c.fillStyle = '#3f9d52';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#47a95b' : '#3f9d52';
      c.fillRect((i * w) / 8, 0, w / 8, h);
    }
    c.strokeStyle = '#e8f5e9';
    c.lineWidth = 3;
    c.strokeRect(w * 0.05, h * 0.12, w * 0.9, h * 0.8);
    c.beginPath();
    c.moveTo(w / 2, h * 0.12);
    c.lineTo(w / 2, h * 0.92);
    c.stroke();
    const hc = countryColors(d.home).primary;
    const ac = countryColors(d.away).primary;
    for (let i = 0; i < 5; i++) {
      const bx = w * (0.3 + 0.08 * Math.sin(d.t * 1.3 + i)) + i * 18;
      c.fillStyle = hc;
      c.fillRect(bx, h * (0.25 + i * 0.13), 14, 14);
      c.fillStyle = ac;
      c.fillRect(w - bx, h * (0.3 + i * 0.12), 14, 14);
    }
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(w * (0.5 + 0.2 * Math.sin(d.t * 2)), h * 0.52, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = HNC_UI.navy;
    c.fillRect(w * 0.3, 0, w * 0.4, h * 0.12);
    c.fillStyle = '#ffffff';
    c.font = mono(h * 0.07);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${d.home} 0-0 ${d.away}`, w / 2, h * 0.06);
  },
  'hnc-news': (c, w, h, d) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0b1d2b');
    g.addColorStop(1, '#142f45');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // Slow light sweep so the wall reads as a live screen.
    const sx = ((d.t * 0.18) % 1.4) - 0.2;
    const sweep = c.createLinearGradient(w * sx, 0, w * (sx + 0.25), 0);
    sweep.addColorStop(0, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.5, 'rgba(247,191,48,0.13)');
    sweep.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sweep;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(247,191,48,0.25)';
    c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.arc(w * 0.78, h * 0.5, h * (0.18 + i * 0.12), 0, Math.PI * 2);
      c.stroke();
    }
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = HNC_UI.gold;
    c.font = mono(h * 0.06);
    c.fillText('HNC SPORTS', w * 0.07, h * 0.3);
    c.fillStyle = HNC_UI.cream;
    c.font = display(h * 0.2);
    c.fillText('WORLD', w * 0.07, h * 0.55);
    c.fillText('TABLE', w * 0.07, h * 0.76);
  },
  breaking: (c, w, h, d) => {
    c.fillStyle = '#8f0f14';
    c.fillRect(0, 0, w, h);
    const pulse = 0.5 + 0.5 * Math.sin(d.t * 6);
    c.fillStyle = `rgba(255,255,255,${0.05 + 0.08 * pulse})`;
    for (let i = -h; i < w; i += 60) {
      c.beginPath();
      c.moveTo(i, h);
      c.lineTo(i + h, 0);
      c.lineTo(i + h + 26, 0);
      c.lineTo(i + 26, h);
      c.fill();
    }
    c.fillStyle = '#ffffff';
    c.font = display(h * 0.26);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BREAKING', w / 2, h * 0.42);
    c.font = mono(h * 0.07);
    c.fillText(`${countryFlag(d.home)} ${countryName(d.home).toUpperCase()} ▲   ${countryFlag(d.away)} ${countryName(d.away).toUpperCase()} ▼`, w / 2, h * 0.7);
  },
  'world-table': (c, w, h, d) => {
    c.fillStyle = HNC_UI.ink;
    c.fillRect(0, 0, w, h);
    c.fillStyle = HNC_UI.gold;
    c.fillRect(0, 0, w, h * 0.03);
    c.font = display(h * 0.12);
    c.fillStyle = HNC_UI.cream;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillText('WORLD TABLE', w * 0.06, h * 0.2);
    const rows = [d.home, d.away, 'BR', 'DE'];
    rows.forEach((code, i) => {
      const y = h * (0.34 + i * 0.16);
      c.fillStyle = i === 0 ? 'rgba(247,191,48,0.16)' : 'rgba(255,255,255,0.03)';
      c.fillRect(w * 0.05, y - h * 0.07, w * 0.9, h * 0.13);
      c.fillStyle = i === 0 ? HNC_UI.gold : HNC_UI.muted;
      c.font = mono(h * 0.06);
      c.fillText(String(i + 1).padStart(2, '0'), w * 0.08, y + h * 0.02);
      c.font = `${h * 0.08}px sans-serif`;
      c.fillText(countryFlag(code), w * 0.17, y + h * 0.03);
      c.fillStyle = HNC_UI.cream;
      c.font = `600 ${h * 0.065}px system-ui, sans-serif`;
      c.fillText(countryName(code), w * 0.28, y + h * 0.025);
      c.font = mono(h * 0.07);
      c.textAlign = 'right';
      c.fillText(String(42 - i * 2 - (i > 0 ? 1 : 0)), w * 0.92, y + h * 0.025);
      c.textAlign = 'left';
    });
  },
};

export const SCREEN_PAINTERS = PAINTERS;

/** Country flag printed on a small desk flag (emoji flag, colour fallback). */
export function paintFlag(ctx: CanvasRenderingContext2D, w: number, h: number, code: string): void {
  const { primary, secondary } = countryColors(code);
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = secondary;
  ctx.fillRect(0, h * 0.4, w, h * 0.2);
  ctx.font = `${h * 1.25}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(countryFlag(code), w / 2, h * 0.56);
}

/** A reusable per-mount CanvasTexture; repaint() each frame when animated. */
export function makeCanvasTexture(w: number, h: number): { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, ctx: canvas.getContext('2d')! };
}
