import { defineConfig, searchForWorkspaceRoot } from 'vite';

// Harness-only dev server for Playwright screenshots. There is no editing UI:
// this server exists so a real Chromium + WebGL can instantiate the HNC
// renderer deterministically. Game sources live outside the package root, so
// the whole monorepo workspace is explicitly allowed.
export default defineConfig({
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
  },
});
