import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/client',
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@client': resolve(__dirname, 'src/client'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
