import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8')) as {
  dependencies: Record<string, string>;
};

describe('published package', () => {
  // The workspace packages are private and bundled into dist. Listed as
  // dependencies they are published as requirements npm cannot resolve, and
  // `npm install godmode` fails with a 404 (0.0.2 and 0.0.3 did).
  it('requires nothing that is not on npm', () => {
    const bundled = Object.keys(manifest.dependencies).filter((name) => name.startsWith('@godmode-cli/'));
    expect(bundled).toEqual([]);
  });

  it('declares every package the bundle imports at run time', () => {
    const directory = resolve(__dirname, '..', 'dist');
    const dist = readdirSync(directory)
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFileSync(resolve(directory, name), 'utf-8'))
      .join('\n');
    const imported = new Set(
      [...dist.matchAll(/from\s*["']([^."'][^"']*)["']/g)]
        .map(([, specifier]) => specifier)
        .filter((specifier) => !specifier.startsWith('node:'))
        .map((specifier) => specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/')),
    );
    const builtin = new Set(builtinModules);
    const missing = [...imported].filter((name) => !builtin.has(name) && !(name in manifest.dependencies));
    expect(missing).toEqual([]);
  });
});
