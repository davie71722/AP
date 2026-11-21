// GAS 版建置：輸出單一 HTML（JS、CSS 內嵌），放進 Google Apps Script 專案的 index.html
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: { 'virtual:pwa-register': '/src/pwa-stub.ts' },
  },
  build: { outDir: 'dist-gas', emptyOutDir: true },
});
