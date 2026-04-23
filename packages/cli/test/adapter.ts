import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

interface Segment { value: string; isParam: boolean }
interface Route { path: string; method: string; version: string; segments: Segment[] }
interface Manifest { name: string; config: { url: string }; routes: Route[]; versions: Array<{ name: string }> }

const METHOD_POSITIONAL: Record<string, string> = {
  get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', head: 'HEAD',
};

export const gm = (...args: string[]) => gmIn(undefined, ...args);

/** Same as gm, but runs the CLI from a specific cwd. Used to exercise the
 *  upward-walk resolver for project-scoped `.godmode/` directories. */
export const gmIn = (cwd: string | undefined, ...args: string[]) => {
  // Test-only: --dry-run and --debug are not CLI flags; they map to env
  // vars internally. Strip them from args and set the env vars.
  const env = { ...process.env };
  const filtered = args.filter((a) => {
    if (a === '--dry-run') { env.GODMODE_DRY_RUN = '1'; return false; }
    if (a === '--debug') { env.GODMODE_DEBUG = '1'; return false; }
    return true;
  });
  const cliEntry = resolve(__dirname, '..', 'dist', 'index.js');
  try {
    return execSync(
      `node ${JSON.stringify(cliEntry)} ${filtered.map((a) => JSON.stringify(a)).join(' ')} 2>&1`,
      { cwd: cwd ?? resolve(__dirname, '..'), encoding: 'utf-8', timeout: 10000, env },
    ).trim();
  } catch (e: any) {
    return (e.stdout || '').trim();
  }
};

function loadManifest(name: string): Manifest {
  const base = resolve(homedir(), '.godmode');
  return JSON.parse(readFileSync(resolve(base, 'extensions', `${name}.json`), 'utf-8'));
}

function buildTestCases(name: string, manifest: Manifest) {
  // Find version-shadowed routes
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
      const methodPositional = METHOD_POSITIONAL[route.method];

      let expectedPath = route.path;
      for (const s of route.segments) {
        if (s.isParam) expectedPath = expectedPath.replace(`{${s.value}}`, `test_${s.value}`);
      }

      acc.push({
        label: `${route.method.toUpperCase()} ${route.path}`,
        args: ['api', name, methodPositional, ...segments, '--dry-run'],
        expected: `${manifest.config.url}${expectedPath}`,
      });
      return acc;
    }, []);
}

export function testAdapter(name: string, configPath: string) {
  describe(`${name} extension`, () => {
    let cases: ReturnType<typeof buildTestCases>;

    beforeAll(() => {
      const list = gm('extension', 'list');
      if (!list.includes(name)) {
        const result = gm('extension', 'add', configPath);
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
      const out = gm('api', name, '--help');
      expect(out).toContain('Usage:');
      expect(out).toContain('Resources:');
    });
  });
}
