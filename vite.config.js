import { defineConfig } from 'vite';
import { spawn } from 'node:child_process';
import path from 'node:path';

export default defineConfig({
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/tts': {
        target: 'http://127.0.0.1:5055',
        changeOrigin: true
      },
      '/api/tts': {
        target: 'http://127.0.0.1:5055',
        rewrite: (path) => path.replace(/^\/api\/tts/, '/tts'),
        changeOrigin: true
      }
    }
  }
});
