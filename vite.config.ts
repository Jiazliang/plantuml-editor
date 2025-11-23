import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Crucial for Electron: ensures assets are loaded with relative paths (./) instead of absolute (/)
  // This allows the app to run from file:// protocol
  base: './',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  }
});