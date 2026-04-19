import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

interface Segment { value: string; isParam: boolean }
interface Route { path: string; method: string; version: string; segments: Segment[] }
interface InterfaceData {
  type: 'api' | 'graphql' | 'mcp';
  url?: string;
  routes: Route[];
  versions?: Array<{ name: string }>;
}
interface MultiManifest {
  name: string;
  slug: string;
  interfaces: Record<'api' | 'graphql' | 'mcp', InterfaceData | undefined>;
}
interface FlatView { url: string; type: InterfaceData['type']; routes: Route[] }

const METHOD_POSITIONAL: Record<string, string> = {
  get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', head: 'HEAD',
};

const CLI_DIR = resolve(import.meta.dirname, '..', '..', 'cli');
const CLI_ENTRY = resolve(CLI_DIR, 'dist', 'index.js');

function ensureCliBuilt() {
  if (!existsSync(CLI_ENTRY)) {
    execSync('pnpm build', { cwd: CLI_DIR, stdio: 'pipe' });
  }
}

export const gm = (...args: string[]) => {
  ensureCliBuilt();
  const env = { ...process.env };
  const filtered = args.filter((a) => {
    if (a === '--dry-run') { env.GODMODE_DRY_RUN = '1'; return false; }
    if (a === '--verbose') { env.GODMODE_VERBOSE = '1'; return false; }
    return true;
  });
  try {
    return execSync(
      `node ${JSON.stringify(CLI_ENTRY)} ${filtered.map((a) => JSON.stringify(a)).join(' ')} 2>&1`,
      { encoding: 'utf-8', timeout: 10000, env },
    ).trim();
  } catch (e: any) {
    return (e.stdout || '').trim();
  }
};

function loadManifest(name: string): MultiManifest {
  const base = process.platform === 'linux' && process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME, 'godmode')
    : resolve(homedir(), '.godmode');
  return JSON.parse(readFileSync(resolve(base, 'extensions', `${name}.json`), 'utf-8'));
}

function primaryInterface(multi: MultiManifest): FlatView {
  const order: Array<'api' | 'graphql' | 'mcp'> = ['api', 'graphql', 'mcp'];
  for (const k of order) {
    const d = multi.interfaces[k];
    if (d) return { url: d.url || '', type: d.type, routes: d.routes };
  }
  throw new Error(`No interfaces declared on ${multi.slug}`);
}

function buildTestCases(name: string, multi: MultiManifest) {
  const view = primaryInterface(multi);
  const segKey = (r: Route) => `${r.method}:${r.segments.map((s) => (s.isParam ? '*' : s.value)).join('/')}`;
  const byKey = new Map<string, Route[]>();
  for (const r of view.routes) {
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

  return view.routes
    .filter((r) => r.segments.length > 0)
    .filter((r) => !shadowed.has(`${r.method}:${r.path}`))
    .reduce<Array<{ label: string; args: string[]; expected: string }>>((acc, route) => {
      const segments = route.segments.map((s) => (s.isParam ? `test_${s.value}` : s.value));
      const methodPositional = METHOD_POSITIONAL[route.method];

      let expectedPath = route.path;
      for (const s of route.segments) {
        if (s.isParam) expectedPath = expectedPath.replace(`{${s.value}}`, `test_${s.value}`);
      }

      const leading = (view.type === 'api' || view.type === 'graphql') && methodPositional ? [methodPositional] : [];
      acc.push({
        label: `${route.method.toUpperCase()} ${route.path}`,
        args: [name, view.type, ...leading, ...segments, '--dry-run'],
        expected: view.type === 'mcp'
          ? `CALL ${view.url} → ${route.path}`
          : `${view.url}${expectedPath}`,
      });
      return acc;
    }, []);
}

export function testAdapter(name: string, configPath: string) {
  describe(`${name} extension`, () => {
    let cases: ReturnType<typeof buildTestCases>;

    beforeAll(() => {
      const list = gm('setup', 'command', 'list');
      if (!list.includes(name)) {
        const result = gm('setup', 'command', 'add', configPath);
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
      const view = primaryInterface(loadManifest(name));
      const out = gm(name, view.type, '--help');
      expect(out).toContain('Usage:');
      expect(out).toContain('Resources:');
    });
  });
}
