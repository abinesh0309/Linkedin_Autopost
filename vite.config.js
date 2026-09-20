import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // React rarely changes, so keeping it in its own chunk lets returning
        // visitors reuse the cached copy across app deployments.
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
});
