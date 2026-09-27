import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { rootHelpRules, subHelpRules, versionRules, type Rule } from '../src/help-rules.js';

const CLI = resolve(__dirname, '..', 'dist', 'index.js');
const FIXTURE_ROOT = mkdtempSync(resolve(tmpdir(), 'godmode-help-compliance-'));
const FIXTURE_EXTENSIONS = resolve(FIXTURE_ROOT, '.godmode', 'extensions');

function gm(...args: string[]): string {
  try {
    return execSync(
      `node ${JSON.stringify(CLI)} ${args.map((a) => JSON.stringify(a)).join(' ')} 2>&1`,
      { cwd: FIXTURE_ROOT, encoding: 'utf-8', timeout: 10_000 },
    );
  } catch (e) {
    return ((e as { stdout?: string }).stdout ?? '');
  }
}

function extRegistered(name: string): boolean {
  return existsSync(resolve(FIXTURE_EXTENSIONS, `${name}.json`));
}

function assertRule(output: string, rule: Rule, label: string) {
  const r = rule.check(output);
  if (!r.ok) {
    expect.fail(`${label}\n  [${rule.severity.toUpperCase()}] ${rule.id}: ${r.message}`);
  }
}

// ── targets ────────────────────────────────────────────────

const ROOT = { label: 'godmode', args: [] as string[] };

const BUILTINS = [
  { name: 'ext', args: ['ext'] },
  { name: 'agent', args: ['agent'] },
] as const;

const EXTENSIONS = [
  { name: 'context7', iface: 'mcp' },
  { name: 'github', iface: 'graphql' },
  { name: 'openai', iface: 'api' },
  { name: 'petstore', iface: 'api' },
  { name: 'slack', iface: 'api' },
  { name: 'stripe', iface: 'api' },
] as const;

mkdirSync(FIXTURE_EXTENSIONS, { recursive: true });
for (const { name, iface } of EXTENSIONS) {
  writeFileSync(resolve(FIXTURE_EXTENSIONS, `${name}.json`), JSON.stringify({
    name,
    slug: name,
    description: 'Help compliance fixture',
    interfaces: {
      [iface]: {
        type: iface,
        specVersion: 'fixture-v1',
        url: 'https://example.com',
        versions: [],
        resourceDescriptions: {},
        routes: [],
      },
    },
  }));
}
afterAll(() => rmSync(FIXTURE_ROOT, { recursive: true, force: true }));

describe('extension compliance fixtures', () => {
  it('makes every extension target available to the compliance matrix', () => {
    expect(EXTENSIONS.filter(({ name }) => !extRegistered(name))).toEqual([]);
  });
});

// ── --version ──────────────────────────────────────────────

describe('godmode --version', () => {
  let output = '';
  beforeAll(() => { output = gm('--version'); });

  it.each(versionRules)('satisfies $id', (rule) => {
    assertRule(output, rule, 'godmode --version');
  });
});

// ── root --help ────────────────────────────────────────────

describe(`${ROOT.label} --help (root)`, () => {
  let output = '';
  beforeAll(() => { output = gm(...ROOT.args, '--help'); });

  it.each(rootHelpRules)('satisfies $id', (rule) => {
    assertRule(output, rule, 'godmode --help');
  });
});

// ── built-ins --help (ext, agent) ──────────────────────────

describe.each(BUILTINS)('godmode $name --help', ({ name, args }) => {
  let output = '';
  beforeAll(() => { output = gm(...args, '--help'); });

  it.each(subHelpRules)('satisfies $id', (rule) => {
    assertRule(output, rule, `godmode ${name} --help`);
  });
});

// ── extensions <iface> --help ──────────────────────────────

describe.each(EXTENSIONS)('godmode $name $iface --help', ({ name, iface }) => {
  let output = '';
  beforeAll(() => { output = gm(name, iface, '--help'); });

  it.each(subHelpRules)('satisfies $id', (rule) => {
    assertRule(output, rule, `godmode ${name} ${iface} --help`);
  });
});

// ── extension overview (godmode <ext> --help) ──────────────

describe.each(EXTENSIONS)('godmode $name --help (overview)', ({ name }) => {
  let output = '';
  beforeAll(() => { output = gm(name, '--help'); });

  it.each(subHelpRules)('satisfies $id', (rule) => {
    assertRule(output, rule, `godmode ${name} --help`);
  });
});

// ── catalog sanity ─────────────────────────────────────────

describe('rule catalog surface', () => {
  it('every rule has id, source, severity, rationale, check', () => {
    for (const r of [...rootHelpRules, ...subHelpRules, ...versionRules]) {
      expect(r.id).toMatch(/^[\w-]+\/[\w-]+$/);
      expect(['help2man', 'mandoc', 'gnu-cs']).toContain(r.source);
      expect(['error', 'warning', 'style']).toContain(r.severity);
      expect(r.rationale).toBeTruthy();
      expect(typeof r.check).toBe('function');
    }
  });
});
