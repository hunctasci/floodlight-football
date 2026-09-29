/**
 * Campaign screen painters (canvas → in-world texture): the coffee machine
 * display, office monitors hiding a match stream, the phone lock screen, the
 * blacked-out "YOUR MATCH IS READY" monitor. Pure functions of their inputs.
 */
import { HNC_UI } from '../graphics/hnc-ui';
import { countryColors } from '../cast/countries';
import { paintFlag } from './screens';

export interface CampaignScreenData {
  home: string;
  away: string;
  t: number;
  ticker?: string;
}
type Painter = (c: CanvasRenderingContext2D, w: number, h: number, d: CampaignScreenData) => void;

const display = (px: number) => `${px}px Impact, 'Arial Black', sans-serif`;
const mono = (px: number, weight = 800) => `${weight} ${px}px ui-monospace, Menlo, monospace`;
const blinkOn = (t: number, hz = 2) => Math.floor(t * hz * 2) % 2 === 0;

function lcd(c: CanvasRenderingContext2D, w: number, h: number, text: string, color: string, t: number, blink = false): void {
  c.fillStyle = '#081109';
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
  if (blink && !blinkOn(t)) return;
  c.fillStyle = color;
  c.shadowColor = color;
  c.shadowBlur = h * 0.18;
  c.font = mono(h * 0.5);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, w / 2, h * 0.54);
  c.shadowBlur = 0;
}

/** A spreadsheet with a thumbnail-sized match stream tucked in the corner. */
function spreadsheet(c: CanvasRenderingContext2D, w: number, h: number): void {
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
}

function miniMatch(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: CampaignScreenData): void {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = '#2f8f47';
  c.fillRect(x, y, w, h);
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i % 2 ? '#36a052' : '#2f8f47';
    c.fillRect(x + (i * w) / 6, y, w / 6, h);
  }
  c.strokeStyle = '#e8f5e9';
  c.lineWidth = 2;
  c.strokeRect(x + w * 0.06, y + h * 0.12, w * 0.88, h * 0.78);
  c.beginPath();
  c.moveTo(x + w / 2, y + h * 0.12);
  c.lineTo(x + w / 2, y + h * 0.9);
  c.stroke();
  const hc = countryColors(d.home).primary;
  const ac = countryColors(d.away).primary;
  for (let i = 0; i < 4; i++) {
    c.fillStyle = hc;
    c.fillRect(x + w * (0.3 + 0.06 * Math.sin(d.t * 1.7 + i)) + i * 6, y + h * (0.25 + i * 0.16), 6, 6);
    c.fillStyle = ac;
    c.fillRect(x + w * (0.6 + 0.06 * Math.cos(d.t * 1.5 + i)) - i * 6, y + h * (0.3 + i * 0.15), 6, 6);
  }
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(x + w * (0.5 + 0.2 * Math.sin(d.t * 2.1)), y + h * (0.5 + 0.2 * Math.cos(d.t * 1.3)), 3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(16,27,49,0.85)';
  c.fillRect(x, y, w * 0.42, h * 0.16);
  c.fillStyle = HNC_UI.cream;
  c.font = mono(h * 0.1);
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(`${d.home} – ${d.away}`, x + 4, y + h * 0.08);
  c.fillStyle = '#e53935';
  c.beginPath();
  c.arc(x + w - 10, y + 9, 4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export const CAMPAIGN_PAINTERS: Record<string, Painter> = {
  'machine-ready': (c, w, h, d) => lcd(c, w, h, 'READY', '#7dffa0', d.t),
  'machine-rematch': (c, w, h, d) => lcd(c, w, h, 'REMATCH', '#ff5a4f', d.t, true),
  'machine-round-2': (c, w, h, d) => lcd(c, w, h, 'ROUND 2', '#ffc93c', d.t, true),
  'machine-out': (c, w, h, d) => lcd(c, w, h, 'NO CUPS', '#ffc93c', d.t),
  'machine-broken': (c, w, h, d) => lcd(c, w, h, Math.floor(d.t * 3) % 3 === 0 ? 'ERR' : 'E-90', '#ff5a4f', d.t, false),
  /** Spreadsheet with a match stream hidden in the corner. */
  'stream-hidden': (c, w, h, d) => {
    spreadsheet(c, w, h);
    c.fillStyle = '#1b2230';
    c.fillRect(w * 0.64, h * 0.62, w * 0.34, h * 0.36);
    miniMatch(c, w * 0.65, h * 0.64, w * 0.32, h * 0.32, d);
  },
  /** Score page being refreshed: a spinner, then the (unknown) score as dashes. */
  'score-refresh': (c, w, h, d) => {
    c.fillStyle = '#f4f6f8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = HNC_UI.navy;
    c.fillRect(0, 0, w, h * 0.16);
    c.fillStyle = HNC_UI.gold;
    c.font = mono(h * 0.08);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('LIVE SCORES', w * 0.05, h * 0.08);
    const spin = (d.t * 8) % (Math.PI * 2);
    c.strokeStyle = '#2f7ff6';
    c.lineWidth = h * 0.03;
    c.beginPath();
    c.arc(w * 0.5, h * 0.55, h * 0.14, spin, spin + 4.2);
    c.stroke();
    c.fillStyle = '#6b7684';
    c.font = mono(h * 0.07, 600);
    c.textAlign = 'center';
    c.fillText('refreshing…', w * 0.5, h * 0.85);
  },
  /** Full-screen stream, alt-tabbed to. */
  'stream-full': (c, w, h, d) => miniMatch(c, 0, 0, w, h, d),
  black: (c, w, h) => {
    c.fillStyle = '#020305';
    c.fillRect(0, 0, w, h);
  },
  /** The one monitor that wakes up: HNC match invitation. */
  'your-match': (c, w, h, d) => {
    c.fillStyle = '#04080f';
    c.fillRect(0, 0, w, h);
    const pulse = 0.75 + 0.25 * Math.sin(d.t * 4);
    c.fillStyle = HNC_UI.gold;
    c.globalAlpha = pulse;
    c.fillRect(w * 0.08, h * 0.16, w * 0.84, h * 0.012);
    c.globalAlpha = 1;
    c.fillStyle = HNC_UI.gold;
    c.font = mono(h * 0.07);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('HNC LEAGUE', w / 2, h * 0.3);
    c.fillStyle = HNC_UI.cream;
    c.font = display(h * 0.19);
    c.fillText('YOUR MATCH', w / 2, h * 0.5);
    c.fillText('IS READY.', w / 2, h * 0.7);
    c.fillStyle = HNC_UI.gold;
    c.fillRect(w * 0.36, h * 0.8, w * 0.28, h * 0.1);
    c.fillStyle = HNC_UI.ink;
    c.font = mono(h * 0.055);
    c.fillText('▶ PLAY', w / 2, h * 0.852);
  },
  /** Phone lock screen: clock + HNC push. */
  'phone-lock': (c, w, h, d) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b1d27');
    g.addColorStop(1, '#101b31');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = HNC_UI.cream;
    c.font = `600 ${h * 0.12}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('23:58', w / 2, h * 0.2);
    c.fillStyle = 'rgba(248,239,219,0.92)';
    const y = h * 0.42;
    c.beginPath();
    c.roundRect(w * 0.06, y, w * 0.88, h * 0.2, w * 0.05);
    c.fill();
    c.fillStyle = HNC_UI.navy;
    c.font = `800 ${h * 0.045}px system-ui, sans-serif`;
    c.textAlign = 'left';
    c.fillText('HNC LEAGUE', w * 0.12, y + h * 0.055);
    c.font = `700 ${h * 0.05}px system-ui, sans-serif`;
    c.fillText('The table is still open.', w * 0.12, y + h * 0.12);
    void d;
  },
  /** A lit TV showing the end of a broadcast (flag + generic slate). */
  'tv-slate': (c, w, h, d) => {
    c.fillStyle = '#0a1320';
    c.fillRect(0, 0, w, h);
    paintFlag(c, w * 0.3, h * 0.3, d.home);
    c.fillStyle = HNC_UI.cream;
    c.font = display(h * 0.14);
    c.textAlign = 'center';
    c.fillText('SEE YOU', w * 0.62, h * 0.4);
    c.fillText('NEXT SUMMER', w * 0.62, h * 0.58);
  },
};

export const CAMPAIGN_SCREEN_IDS = Object.keys(CAMPAIGN_PAINTERS);
