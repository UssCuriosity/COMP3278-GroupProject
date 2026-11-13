import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// "npm run build" writes the production files to dist/web, which the server serves.
// "npm run dev" runs this dev server on port 5173 and forwards /api to the API
// server, whose port is read from PORT in the project's .env file.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, '..'), '');
  return {
    root: import.meta.dirname,
    plugins: [react()],
    build: { outDir: '../dist/web', emptyOutDir: true },
    server: {
      port: 5173,
      proxy: { '/api': `http://localhost:${env.PORT || 3000}` },
    },
  };
});
