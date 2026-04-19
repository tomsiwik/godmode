import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/mcp-server.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // Bundle internal workspace packages so their .ts-only exports don't
  // require a TS-loader at runtime.
  noExternal: [/^@godmode-cli\//, 'godmode'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
