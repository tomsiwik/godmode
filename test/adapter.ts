import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

interface Segment { value: string; isParam: boolean }
interface Route { path: string; method: string; version: string; segments: Segment[] }
interface Manifest { name: string; config: { url: string }; routes: Route[]; versions: Array<{ name: string }> }

const METHOD_FLAG: Record<string, string[]> = {
  get: [], post: ['--post'], put: ['--put'], patch: ['--patch'], delete: ['-d'], head: ['--head'],
};

export const gm = (...args: string[]) => {
  try {
    return execSync(
      `node dist/index.js ${args.map((a) => JSON.stringify(a)).join(' ')} 2>&1`,
      { cwd: resolve(__dirname, '..'), encoding: 'utf-8', timeout: 10000 },
    ).trim();
  } catch (e: any) {
    return (e.stdout || '').trim();
  }
};

/**
 * Generic adapter test suite. Registers an API from a config file,
 * then verifies every route in the spec resolves to the correct URL.
 */
export function describeAdapter(name: string, configPath: string) {
  describe(`${name} adapter`, () => {
    let manifest: Manifest;

    beforeAll(() => {
      // Ensure the API is registered
      const list = gm('list');
      if (!list.includes(name)) {
        const result = gm('add', resolve(__dirname, '..', configPath));
        if (result.includes('Error') || result.includes('failed')) {
          throw new Error(`Failed to add ${name}: ${result}`);
        }
      }

      const manifestPath = resolve(
        process.platform === 'linux' && process.env.XDG_CONFIG_HOME
          ? resolve(process.env.XDG_CONFIG_HOME, 'godmode')
          : resolve(homedir(), '.godmode'),
        'apis', `${name}.json`);
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    });

    it('registered with routes', () => {
      expect(manifest.routes.length).toBeGreaterThan(0);
      expect(manifest.config.url).toBeTruthy();
    });

    it('every route resolves to the correct URL', { timeout: 300_000 }, () => {
      const failures: string[] = [];

      // Find version collisions
      const segKey = (r: Route) => `${r.method}:${r.segments.map((s) => (s.isParam ? '*' : s.value)).join('/')}`;
      const byKey = new Map<string, Route[]>();
      for (const r of manifest.routes) {
        const k = segKey(r);
        const arr = byKey.get(k) || [];
        arr.push(r);
        byKey.set(k, arr);
      }
      const shadowed = new Set<string>();
      for (const [, routes] of byKey) {
        const versions = [...new Set(routes.map((r) => r.version))];
        if (versions.length > 1) {
          const latest = versions.sort().pop()!;
          for (const r of routes) {
            if (r.version !== latest) shadowed.add(`${r.method}:${r.path}`);
          }
        }
      }

      for (const route of manifest.routes) {
        if (shadowed.has(`${route.method}:${route.path}`)) continue;
      if (!route.segments.length) continue; // root path — no segments to match

        const segments = route.segments.map((s) => (s.isParam ? `test_${s.value}` : s.value));
        const flags = METHOD_FLAG[route.method] || [];
        const out = gm(name, ...segments, ...flags, '--dry-run');

        let expectedPath = route.path;
        for (const s of route.segments) {
          if (s.isParam) expectedPath = expectedPath.replace(`{${s.value}}`, `test_${s.value}`);
        }
        const expectedUrl = `${manifest.config.url}${expectedPath}`;

        if (!out.includes(expectedUrl)) {
          failures.push(`${route.method.toUpperCase()} ${route.path}\n  expected: ${expectedUrl}\n  got:      ${out.slice(0, 150)}`);
        }
      }

      if (shadowed.size) console.log(`  (${shadowed.size} routes shadowed by later version)`);

      if (failures.length) {
        throw new Error(`${failures.length}/${manifest.routes.length} routes failed:\n\n${failures.slice(0, 20).join('\n\n')}${failures.length > 20 ? `\n\n... and ${failures.length - 20} more` : ''}`);
      }
    });

    it('info returns resources', () => {
      const out = gm(name, 'info');
      const names = out.trim().split(/\s+/).filter(Boolean);
      expect(names.length).toBeGreaterThan(0);
    });

    it('--help shows usage', () => {
      const out = gm(name, '--help');
      expect(out).toContain('Usage:');
    });
  });
}
