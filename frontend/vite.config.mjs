import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The whole project has ONE package.json (at the repo root). The React app
// lives in /frontend and builds into /dist at the repo root, which is what
// Vercel serves as the website.
export default defineConfig({
  root: here,
  plugins: [react()],
  build: {
    outDir: path.resolve(here, '..', 'dist'),
    emptyOutDir: true,
  },
  server: {
    host: true,        // reachable as localhost AND from a phone on the same Wi-Fi
    port: 5173,
    strictPort: false,
    // Local development only: forward API calls to the Express server.
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
});
