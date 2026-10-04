import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths, so the build works at any address (GitHub Pages, local preview, any sub-path).
  base: './',
  plugins: [react(), tailwindcss()],
  // Module workers (MapLibre's map worker imports shared code).
  worker: { format: 'es' },
});
