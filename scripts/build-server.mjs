// build-server.mjs — compila server/_core/index.ts via esbuild JS API
// Evita dependência do binário nativo do esbuild que o pnpm bloqueia em CI
import { build } from 'esbuild';

await build({
  entryPoints: ['server/_core/index.ts'],
  platform: 'node',
  packages: 'external',
  bundle: true,
  format: 'esm',
  outdir: 'dist',
});

console.log('Server build completo: dist/index.js');
