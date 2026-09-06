import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
  server: {
    port: 9527,
    strictPort: true,
    open: false,
  }
});
