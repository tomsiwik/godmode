import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

interface Segment { value: string; isParam: boolean }
interface Route { path: string; method: string; version: string; segments: Segment[] }
interface Manifest { name: string; config: { url: string }; routes: Route[]; versions: Array<{ name: string }> }

const METHOD_FLAG: Record<string, string[]> = {
  get: ['-g'], post: ['-po'], put: ['-pu'], patch: ['-pa'], delete: ['-d'], head: ['--head'],
};

export const gm = (...args: string[]) => {
  try {
    return execSync(
      `npx godmode ${args.map((a) => JSON.stringify(a)).join(' ')} 2>&1`,
      { encoding: 'utf-8', timeout: 10000 },
    ).trim();
  } catch (e: any) {
    return (e.stdout || '').trim();
  }
};

function loadManifest(name: string): Manifest {
  const base = process.platform === 'linux' && process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME, 'godmode')
    : resolve(homedir(), '.godmode');
  return JSON.parse(readFileSync(resolve(base, 'apis', `${name}.json`), 'utf-8'));
}

function buildTestCases(name: string, manifest: Manifest) {
  const segKey = (r: Route) => `${r.method}:${r.segments.map((s) => (s.isParam ? '*' : s.value)).join('/')}`;
  const byKey = new Map<string, Route[]>();
  for (const r of manifest.routes) {
    const k = segKey(r);
    (byKey.get(k) || (() => { const a: Route[] = []; byKey.set(k, a); return a; })()).push(r);
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

  return manifest.routes
    .filter((r) => r.segments.length > 0)
    .filter((r) => !shadowed.has(`${r.method}:${r.path}`))
    .reduce<Array<{ label: string; args: string[]; expected: string }>>((acc, route) => {
      const segments = route.segments.map((s) => (s.isParam ? `test_${s.value}` : s.value));
      const flags = METHOD_FLAG[route.method] || [];

      let expectedPath = route.path;
      for (const s of route.segments) {
        if (s.isParam) expectedPath = expectedPath.replace(`{${s.value}}`, `test_${s.value}`);
      }

      acc.push({
        label: `${route.method.toUpperCase()} ${route.path}`,
        args: [name, ...segments, ...flags, '--dry-run'],
        expected: `${manifest.config.url}${expectedPath}`,
      });
      return acc;
    }, []);
}

export function testAdapter(name: string, configPath: string) {
  describe(`${name} adapter`, () => {
    let cases: ReturnType<typeof buildTestCases>;

    beforeAll(() => {
      const list = gm('list');
      if (!list.includes(name)) {
        const result = gm('add', configPath);
        if (result.includes('Error') || result.includes('failed')) {
          throw new Error(`Failed to add ${name}: ${result}`);
        }
      }
      cases = buildTestCases(name, loadManifest(name));
    });

    it('all routes resolve to correct URLs', { timeout: 300_000 }, () => {
      const failures = cases
        .map(({ label, args, expected }) => {
          const out = gm(...args);
          return out.includes(expected) ? null : `${label}\n  expected: ${expected}\n  got:      ${out.slice(0, 150)}`;
        })
        .filter(Boolean);

      expect(failures, failures.slice(0, 10).join('\n\n')).toHaveLength(0);
    });

    it('--help shows usage and resources', () => {
      const out = gm(name, '--help');
      expect(out).toContain('Usage:');
      expect(out).toContain('Resources:');
    });
  });
}
