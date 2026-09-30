import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths, so the build works at any address (GitHub Pages serves it under /trip-planner/).
  base: './',
  plugins: [react(), tailwindcss()],
});
