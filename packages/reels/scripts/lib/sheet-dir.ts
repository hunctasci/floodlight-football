/** Dev helper: `tsx scripts/lib/sheet-dir.ts <dir> [cols]` → <dir>/sheet.png from its PNGs. */
import { readdirSync } from 'node:fs';
import { contactSheet } from './remotion';

const dir = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith('.png') && f !== 'sheet.png').sort();
await contactSheet(files.map((f) => ({ file: `${dir}/${f}`, label: f.replace('.png', '') })), `${dir}/sheet.png`, Number(process.argv[3] ?? 5), 240);
console.log(`${dir}/sheet.png`);
