/**
 * Geometric national flags for in-world cloth, desk flags and posters.
 * Emoji flags are fine at thumbnail size, but a waving flag that fills the
 * frame must be drawn to its official construction. Pure canvas painters;
 * `paintNationalFlag` returns false for countries without a construction
 * (callers fall back to the emoji painter).
 */
type Painter = (c: CanvasRenderingContext2D, w: number, h: number) => void;

const vertical = (colors: string[]): Painter => (c, w, h) => colors.forEach((col, i) => {
  c.fillStyle = col;
  c.fillRect(Math.floor((i * w) / colors.length), 0, Math.ceil(w / colors.length) + 1, h);
});
const horizontal = (colors: string[]): Painter => (c, w, h) => colors.forEach((col, i) => {
  c.fillStyle = col;
  c.fillRect(0, Math.floor((i * h) / colors.length), w, Math.ceil(h / colors.length) + 1);
});

function star(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, rotation: number): void {
  const inner = r * 0.382;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rotation + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : inner;
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

/**
 * Türk Bayrağı Kanunu construction on a 1200×800 (G = 800) reference: outer
 * crescent circle (cx 425, r 200), inner circle (cx 475, r 160), star in a
 * circle of r 100 centred at 683.3 with one point toward the hoist.
 */
const TR: Painter = (c, w, h) => {
  const k = h / 800;
  const ox = (w - 1200 * k) / 2;
  c.fillStyle = '#e30a17';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(ox + 425 * k, 400 * k, 200 * k, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e30a17';
  c.beginPath();
  c.arc(ox + 475 * k, 400 * k, 160 * k, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  star(c, ox + 683.334 * k, 400 * k, 100 * k, Math.PI);
};

const GR: Painter = (c, w, h) => {
  const stripe = h / 9;
  for (let i = 0; i < 9; i++) {
    c.fillStyle = i % 2 ? '#ffffff' : '#0d5eaf';
    c.fillRect(0, i * stripe, w, stripe + 1);
  }
  c.fillStyle = '#0d5eaf';
  c.fillRect(0, 0, stripe * 5, stripe * 5);
  c.fillStyle = '#ffffff';
  c.fillRect(0, stripe * 2, stripe * 5, stripe);
  c.fillRect(stripe * 2, 0, stripe, stripe * 5);
};

const JP: Painter = (c, w, h) => {
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#bc002d';
  c.beginPath();
  c.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
  c.fill();
};

const AR: Painter = (c, w, h) => {
  horizontal(['#74acdf', '#ffffff', '#74acdf'])(c, w, h);
  c.fillStyle = '#f6b40e';
  c.beginPath();
  c.arc(w / 2, h / 2, h * 0.1, 0, Math.PI * 2);
  c.fill();
};

const FLAGS: Record<string, Painter> = {
  TR,
  GR,
  JP,
  AR,
  BE: vertical(['#1a1a1a', '#fdda24', '#ef3340']),
  IT: vertical(['#009246', '#ffffff', '#ce2b37']),
  FR: vertical(['#002654', '#ffffff', '#ce1126']),
  DE: horizontal(['#000000', '#dd0000', '#ffce00']),
  NL: horizontal(['#ae1c28', '#ffffff', '#21468b']),
};

export function hasNationalFlag(code: string): boolean {
  return code in FLAGS;
}

export function paintNationalFlag(c: CanvasRenderingContext2D, w: number, h: number, code: string): boolean {
  const f = FLAGS[code];
  if (!f) return false;
  c.save();
  f(c, w, h);
  c.restore();
  return true;
}
