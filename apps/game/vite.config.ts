import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// Cloudflare-native dev/prod: the same origin serves the built game (Static
// Assets) and the control-plane Worker (rooms + signaling). `npm run dev`
// gives frontend + Worker runtime + local Durable Objects with no Docker.
export default defineConfig({
  plugins: [cloudflare()],
});
