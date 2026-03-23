import { resolve } from 'node:path';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  dts: true,
  external: ['react', 'react-dom'],
  outDir: 'dist',
  clean: true,
  alias: {
    '@': resolve(import.meta.dirname, 'src'),
  },
});
