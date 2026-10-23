import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Serves the MSW worker script straight from node_modules in mock mode, so it
// never has to live in `public/` and end up in the production build.
function mockServiceWorker(): Plugin {
  const workerPath = fileURLToPath(
    new URL('./node_modules/msw/lib/mockServiceWorker.js', import.meta.url),
  );

  return {
    name: 'mock-service-worker',
    apply: (_config, { mode }) => mode === 'mock',
    configureServer(server) {
      server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(readFileSync(workerPath));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mockServiceWorker()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
