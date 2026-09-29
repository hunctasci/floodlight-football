#!/usr/bin/env tsx
/**
 * reels:campaign-overview — the campaign success test as images:
 *   overview/reels-first-frames.png  every reel's frame 0 (the hook)
 *   overview/reels-thumbs.png        every reel at its keyArt `thumb`
 *   overview/posts.png               every post.png
 * "Would somebody believe these came from the same brand? Do they all look
 * like the same video?"
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { compileContent } from '../src/engine/director/compile';
import { CAMPAIGN, CAMPAIGN_ROOT, campaignDir } from '../src/content/autumn-2026/campaign';
import { contactSheet, stills } from './lib/remotion';

const out = path.resolve(CAMPAIGN_ROOT, 'overview');
mkdirSync(out, { recursive: true });
const first: { file: string; label: string }[] = [];
const thumbs: { file: string; label: string }[] = [];
for (const item of CAMPAIGN) {
  const tl = compileContent(item.reel);
  const thumb = tl.markers['key:thumb'] ?? Math.round(tl.totalFrames / 2);
  const files = await stills('Content', { spec: item.reel, format: 'reel' }, [0, thumb], (f) => path.join(out, 'frames', `${item.dir}-${f}.png`));
  first.push({ file: files[0], label: `${String(item.n).padStart(2, '0')} ${item.title}` });
  thumbs.push({ file: files[1], label: `${String(item.n).padStart(2, '0')} ${item.title}` });
}
await contactSheet(first, path.join(out, 'reels-first-frames.png'), 5, 300);
await contactSheet(thumbs, path.join(out, 'reels-thumbs.png'), 5, 300);
const posts = CAMPAIGN.map((c) => ({ file: path.resolve(campaignDir(c), 'post.png'), label: `${String(c.n).padStart(2, '0')} ${c.title}` })).filter((p) => existsSync(p.file));
await contactSheet(posts, path.join(out, 'posts.png'), 5, 320);
console.log(out);
process.exit(0);
