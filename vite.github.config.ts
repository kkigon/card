import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/card/',
  plugins: [react()],
  build: {
    outDir: 'gh-pages',
    emptyOutDir: true,
  },
});
