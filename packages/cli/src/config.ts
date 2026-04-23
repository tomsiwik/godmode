import { resolve, basename, dirname, extname, parse as parsePath } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir, unlink, access, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import {
  compileInterface,
  projectManifest,
  type InterfaceKey,
  type Manifest,
  type ManifestSource,
  type MultiManifest,
} from './spec.js';

/** Global config directory — always `~/.godmode`. */
export const GODMODE_HOME = resolve(homedir(), '.godmode');

/** Scope for reads and writes. `project` = the nearest `.godmode/` walking
 *  upward from cwd; `global` = `~/.godmode`. */
export type Scope = 'project' | 'global';

const INTERFACE_KEYS: readonly InterfaceKey[] = ['api', 'graphql', 'mcp'] as const;

/** Files this CLI generates under `.godmode/` that should not be committed. */
const GITIGNORE_CONTENT = `# godmode — runtime artifacts, do not commit
node_modules/
coding-agents/
package-lock.json
`;

// ── directory resolution ─────────────────────────────────────

/** Walk upward from `start` until a `.godmode/` directory is found. Returns
 *  the full path to the directory, or null if none exists between `start`
 *  and the filesystem root. Read-only — never creates anything. */
function findProjectGodmode(start: string = process.cwd()): string | null {
  let dir = resolve(start);
  const root = parsePath(dir).root;
  while (true) {
    const candidate = resolve(dir, '.godmode');
    if (existsSync(candidate)) return candidate;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

/** Returns the extensions directory for a scope, lazily creating the
 *  scope's base dir if it's a write operation. For project writes, this
 *  also seeds a `.gitignore`. For global, it one-time-migrates the legacy
 *  `apis/` name if present. */
async function ensureScopeDir(scope: Scope): Promise<string> {
  if (scope === 'global') {
    await mkdir(GODMODE_HOME, { recursive: true });
    const legacy = resolve(GODMODE_HOME, 'apis');
    const target = resolve(GODMODE_HOME, 'extensions');
    if ((await exists(legacy)) && !(await exists(target))) {
      await rename(legacy, target);
      process.stderr.write(`Migrated ${legacy} -> ${target}\n`);
    }
    await mkdir(target, { recursive: true });
    return target;
  }

  // Project scope. Prefer an existing `.godmode/` above cwd; if none, seed
  // a new one in cwd with a .gitignore so runtime artifacts are never
  // accidentally committed.
  let projectRoot = findProjectGodmode();
  if (!projectRoot) {
    projectRoot = resolve(process.cwd(), '.godmode');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(resolve(projectRoot, '.gitignore'), GITIGNORE_CONTENT);
  }
  const target = resolve(projectRoot, 'extensions');
  await mkdir(target, { recursive: true });
  return target;
}

/** Read-only resolver: returns the extensions dir for a scope, or null if
 *  nothing exists yet for that scope. Never creates anything. */
function scopeExtensionsDirSync(scope: Scope): string | null {
  if (scope === 'global') {
    const d = resolve(GODMODE_HOME, 'extensions');
    return existsSync(d) ? d : null;
  }
  const project = findProjectGodmode();
  if (!project) return null;
  const d = resolve(project, 'extensions');
  return existsSync(d) ? d : null;
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

// ── load raw manifest.yaml authored by user ───────────────────

function validateSource(raw: unknown, origin: string): ManifestSource {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`${origin}: not a valid object`);
  }
  const m = raw as Partial<ManifestSource>;
  if (!m.name || typeof m.name !== 'string') {
    throw new Error(`${origin}: missing or invalid 'name'`);
  }
  if (!m.interfaces || typeof m.interfaces !== 'object' || Object.keys(m.interfaces).length === 0) {
    throw new Error(`${origin}: 'interfaces' must be an object with at least one key`);
  }
  for (const key of Object.keys(m.interfaces)) {
    if (!INTERFACE_KEYS.includes(key as InterfaceKey)) {
      throw new Error(
        `${origin}: unknown interface '${key}' (valid: ${INTERFACE_KEYS.join(', ')})`,
      );
    }
  }
  return m as ManifestSource;
}

async function loadSourceFromDir(dir: string): Promise<ManifestSource | null> {
  for (const ext of ['.yaml', '.yml', '.json']) {
    const filePath = resolve(dir, `manifest${ext}`);
    if (await exists(filePath)) {
      const text = await readFile(filePath, 'utf-8');
      const raw = ext === '.json' ? JSON.parse(text) : parseYaml(text);
      return validateSource(raw, filePath);
    }
  }
  return null;
}

async function loadSourceFromFile(filePath: string): Promise<{ source: ManifestSource; dir: string } | null> {
  if (!(await exists(filePath))) return null;
  const ext = extname(filePath);
  if (!['.yaml', '.yml', '.json'].includes(ext)) return null;
  const text = await readFile(filePath, 'utf-8');
  const raw = ext === '.json' ? JSON.parse(text) : parseYaml(text);
  return { source: validateSource(raw, filePath), dir: dirname(filePath) };
}

async function resolveSource(input: string): Promise<{ name: string; source: ManifestSource; dir: string }> {
  const asPath = resolve(process.cwd(), input);

  const fromFile = await loadSourceFromFile(asPath);
  if (fromFile) {
    const name = fromFile.source.slug || fromFile.source.name || basename(fromFile.dir);
    return { name, source: fromFile.source, dir: fromFile.dir };
  }

  const fromDir = await loadSourceFromDir(asPath);
  if (fromDir) {
    const name = fromDir.slug || fromDir.name || basename(asPath);
    return { name, source: fromDir, dir: asPath };
  }

  try {
    const pkgDir = resolve(import.meta.dirname, '..', '..', '..', 'extensions', input);
    const fromPkg = await loadSourceFromDir(pkgDir);
    if (fromPkg) {
      const name = fromPkg.slug || fromPkg.name || input;
      return { name, source: fromPkg, dir: pkgDir };
    }
  } catch {}

  throw new Error(
    `No manifest found: ${input} (expected manifest file, folder containing manifest.yaml, or @godmode-cli/${input})`,
  );
}

// ── add: compile every declared interface, write a MultiManifest ──

export async function addApi(input: string, scope: Scope = 'project') {
  const extensionsDir = await ensureScopeDir(scope);

  const resolved = await resolveSource(input).catch(() => null);

  if (resolved) {
    const { name, source } = resolved;
    const ifaceKeys = Object.keys(source.interfaces).filter((k) =>
      INTERFACE_KEYS.includes(k as InterfaceKey),
    ) as InterfaceKey[];

    if (ifaceKeys.length > 0) {
      const multi: MultiManifest = {
        name: source.name,
        slug: source.slug || name,
        description: source.description || '',
        auth: source.auth,
        headers: source.headers,
        interfaces: {},
      };

      for (const iface of ifaceKeys) {
        const data = await compileInterface(iface, name, source);
        (multi.interfaces as Record<string, unknown>)[iface] = data;
      }

      await writeFile(resolve(extensionsDir, `${name}.json`), JSON.stringify(multi, null, 2));

      const ifaceSummary = ifaceKeys
        .map((k) => {
          const d = multi.interfaces[k];
          return d ? `${k}=${d.routes.length}` : k;
        })
        .join(', ');
      process.stderr.write(`Registered "${name}" [${scope}] - interfaces: ${ifaceSummary}\n`);
      return;
    }
  }

  // Package-based extension (no `interfaces` key) — install via npm into
  // the scope's root. Project scope installs under <cwd>/.godmode/,
  // global under ~/.godmode.
  const scopeRoot = scope === 'global' ? GODMODE_HOME : dirname(extensionsDir);
  const name = resolved?.name || input;
  const installTarget = resolved?.dir && (await exists(resolve(resolved.dir, 'package.json')))
    ? resolved.dir
    : (input.startsWith('@') ? input : `@godmode-cli/${input}`);

  process.stderr.write(`Installing ${name} [${scope}]...\n`);
  try {
    execSync(`npm install ${installTarget} --prefix ${scopeRoot}`, { stdio: 'pipe' });
  } catch (e: unknown) {
    const err = e as { stderr?: { toString(): string }; message?: string };
    throw new Error(`Failed to install ${name}: ${err.stderr?.toString().trim() || err.message}`);
  }

  const pkgName = `@godmode-cli/${name}`;
  const mcpConfigPath = resolve(scopeRoot, 'node_modules', pkgName, '.mcp.json');
  if (await exists(mcpConfigPath)) {
    process.stderr.write(`Installed "${name}" (MCP server extension)\n`);
  } else {
    process.stderr.write(`Installed "${name}"\n`);
  }
}

export async function updateApi(name: string, scope?: Scope) {
  // If no scope given, update wherever the extension currently lives.
  const resolvedScope = scope ?? findInstalledScope(name);
  if (!resolvedScope) {
    process.stderr.write(`Extension "${name}" not found\n`);
    process.exit(1);
  }
  await addApi(name, resolvedScope);
}

export async function removeApi(name: string, scope?: Scope) {
  const resolvedScope = scope ?? findInstalledScope(name);
  if (!resolvedScope) {
    process.stderr.write(`Extension "${name}" not found\n`);
    process.exit(1);
  }
  const dir = scopeExtensionsDirSync(resolvedScope);
  if (!dir) {
    process.stderr.write(`Extension "${name}" not found\n`);
    process.exit(1);
  }
  try {
    await unlink(resolve(dir, `${name}.json`));
    process.stderr.write(`Removed "${name}" [${resolvedScope}]\n`);
  } catch {
    process.stderr.write(`Extension "${name}" not found\n`);
    process.exit(1);
  }
}

/** Returns the scope in which `name` is installed, preferring project.
 *  Null if not installed in either. */
function findInstalledScope(name: string): Scope | null {
  for (const scope of ['project', 'global'] as const) {
    const dir = scopeExtensionsDirSync(scope);
    if (dir && existsSync(resolve(dir, `${name}.json`))) return scope;
  }
  return null;
}

export async function listApis() {
  const rows: Array<{ scope: Scope; slug: string; ifaces: string; routeTotal: number; description: string; shadowed: boolean }> = [];
  const seen = new Set<string>();

  // Project first so it gets to mark its slugs; globals with the same slug
  // are annotated as shadowed.
  for (const scope of ['project', 'global'] as const) {
    const dir = scopeExtensionsDirSync(scope);
    if (!dir) continue;
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const m: MultiManifest = JSON.parse(await readFile(resolve(dir, file), 'utf-8'));
      const shadowed = scope === 'global' && seen.has(m.slug);
      seen.add(m.slug);
      rows.push({
        scope,
        slug: m.slug,
        ifaces: Object.keys(m.interfaces).join(', '),
        routeTotal: Object.values(m.interfaces).reduce((n, d) => n + (d?.routes.length ?? 0), 0),
        description: m.description || '',
        shadowed,
      });
    }
  }

  if (!rows.length) {
    console.log('No extensions installed. Run: godmode ext install <name>');
    return;
  }
  for (const r of rows) {
    const tag = `[${r.scope}${r.shadowed ? ', shadowed' : ''}]`;
    const desc = r.description ? `  ${r.description}` : '';
    console.log(`  ${r.slug}\t${tag}\t[${r.ifaces}]\t${r.routeTotal} routes${desc}`);
  }
}

/** Reads the manifest from the first scope that has it. Project scope
 *  wins over global. */
export async function loadMultiManifest(name: string): Promise<MultiManifest> {
  for (const scope of ['project', 'global'] as const) {
    const dir = scopeExtensionsDirSync(scope);
    if (!dir) continue;
    const path = resolve(dir, `${name}.json`);
    if (!existsSync(path)) continue;
    return JSON.parse(await readFile(path, 'utf-8'));
  }
  process.stderr.write(`Extension "${name}" not found. Run: godmode ext install ${name}\n`);
  process.exit(1);
}

/**
 * Backwards-compatible loader: returns a flat Manifest projected onto one interface.
 * Caller specifies which interface they want. If the extension doesn't declare it,
 * an error is thrown.
 */
export async function loadManifest(name: string, iface?: InterfaceKey): Promise<Manifest> {
  const multi = await loadMultiManifest(name);
  const declared = Object.keys(multi.interfaces) as InterfaceKey[];
  if (declared.length === 0) {
    process.stderr.write(`Extension "${name}" has no interfaces declared\n`);
    process.exit(1);
  }
  // If no interface requested, pick the first declared one.
  const target = iface ?? declared[0];
  if (!multi.interfaces[target]) {
    process.stderr.write(
      `Extension "${name}" does not declare a '${target}' interface (declared: ${declared.join(', ')}).\n`,
    );
    process.stderr.write(`Try: godmode ${declared[0]} ${name} --help\n`);
    process.exit(1);
  }
  return projectManifest(multi, target);
}

/** Sync lookup used by the CLI dispatcher to decide whether a given slug is
 *  an installed extension. Project-first, global fallback. */
export function findInstalledManifestSync(name: string): MultiManifest | null {
  for (const scope of ['project', 'global'] as const) {
    const dir = scopeExtensionsDirSync(scope);
    if (!dir) continue;
    const path = resolve(dir, `${name}.json`);
    if (!existsSync(path)) continue;
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as MultiManifest;
    } catch {
      return null;
    }
  }
  return null;
}
