import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import { nitro } from 'nitro/vite';

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
  },
  plugins: [
    mdx(await import('./source.config')),
    tailwindcss(),
    tanstackStart(),
    react(),
    nitro({
      preset: 'vercel',
      vercel: {
        functions: {
          runtime: 'nodejs22.x',
          architecture: 'arm64',
          supportsResponseStreaming: true,
        },
      },
      compressPublicAssets: {
        brotli: true,
        gzip: true,
      },
      minify: true,
      routeRules: {
        '/assets/**': {
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        },
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
