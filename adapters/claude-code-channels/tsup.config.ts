import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/channels.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
});
