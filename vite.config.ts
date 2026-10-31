import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
function pdfAssets() {
  mkdirSync('public/pdf-assets', { recursive: true });
  for (const name of ['cmaps', 'standard_fonts', 'wasm']) cpSync(`node_modules/pdfjs-dist/${name}`, `public/pdf-assets/${name}`, { recursive: true });
}
pdfAssets();
export default defineConfig({ base: './', plugins: [react()], build: { chunkSizeWarningLimit: 900, rollupOptions: { output: { manualChunks: { math: ['katex'] } } } } });
