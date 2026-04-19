import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { rootHelpRules, subHelpRules, versionRules, type Rule } from '../src/help-rules.js';

const CLI = resolve(__dirname, '..', 'dist', 'index.js');
const GODMODE_HOME =
  process.platform === 'linux' && process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME, 'godmode')
    : resolve(homedir(), '.godmode');

function gm(...args: string[]): string {
  try {
    return execSync(
      `node ${JSON.stringify(CLI)} ${args.map((a) => JSON.stringify(a)).join(' ')} 2>&1`,
      { encoding: 'utf-8', timeout: 10_000 },
    );
  } catch (e) {
    return ((e as { stdout?: string }).stdout ?? '');
  }
}

function extRegistered(name: string): boolean {
  return existsSync(resolve(GODMODE_HOME, 'apis', `${name}.json`));
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
  const skip = !extRegistered(name);
  let output = '';
  beforeAll(() => { if (!skip) output = gm(name, iface, '--help'); });

  (skip ? it.skip : it).each(subHelpRules)('satisfies $id', (rule) => {
    assertRule(output, rule, `godmode ${name} ${iface} --help`);
  });
});

// ── extension overview (godmode <ext> --help) ──────────────

describe.each(EXTENSIONS)('godmode $name --help (overview)', ({ name }) => {
  const skip = !extRegistered(name);
  let output = '';
  beforeAll(() => { if (!skip) output = gm(name, '--help'); });

  (skip ? it.skip : it).each(subHelpRules)('satisfies $id', (rule) => {
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
