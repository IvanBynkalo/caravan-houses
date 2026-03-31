import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import { resolve }      from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@caravan/shared': resolve(__dirname, '../../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api':    { target: 'http://localhost:3000', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/ws':     { target: 'ws://localhost:3000',   ws: true },
    },
  },
});
