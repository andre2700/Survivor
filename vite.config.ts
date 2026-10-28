import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` gera um único index.html com tudo embutido (útil para compartilhar/testar no celular).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  // arquivo único: as músicas não entram no index.html (ficam em music/, ao lado)
  resolve: { alias: mode === 'single' ? [{ find: /^\.\/musicUrls$/, replacement: resolve(__dirname, 'src/systems/musicUrls.single.ts') }] : [] },
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
}));
