import { resolve, basename, dirname, extname, isAbsolute, parse as parsePath, relative } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir, unlink, access, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import {
  compileInterface,
  projectManifest,
  type InterfaceKey,
  type Manifest,
  type ManifestSource,
  type MultiManifest,
} from './spec.js';
import { BUILTINS } from './builtins.js';
import { generateSkill } from './skill.js';

/** Global config directory — always `~/.godmode`. */
export const GODMODE_HOME = resolve(homedir(), '.godmode');

/** Scope for reads and writes. `project` = the nearest `.godmode/` walking
 *  upward from cwd; `global` = `~/.godmode`. */
export type Scope = 'project' | 'global';

const INTERFACE_KEYS: readonly InterfaceKey[] = ['api', 'graphql', 'mcp', 'command', 'orchestrator'] as const;

/** A slug is occupied by whichever extension registered it: built-ins ship
 *  registered, installed extensions register on install. Re-installing the
 *  same extension (same package, or a local manifest) is an update and OK. */
function assertSlugFree(slug: string, scope: Scope, packageName?: string): void {
  if (BUILTINS.has(slug)) {
    throw new Error(`'${slug}' is a built-in godmode extension; its slug is always in use.`);
  }
  const dir = scopeExtensionsDirSync(scope);
  if (!dir) return;
  const manifestPath = resolve(dir, `${slug}.json`);
  if (!existsSync(manifestPath)) return;
  let existing: MultiManifest;
  try {
    existing = JSON.parse(readFileSync(manifestPath, 'utf-8')) as MultiManifest;
  } catch {
    return;
  }
  if (existing.packageName === packageName) return;
  throw new Error(
    `'${slug}' is already in use by ${existing.packageName || 'an installed extension'}.\nRun 'godmode ext uninstall ${slug}' first.`,
  );
}

function isValidNpmPackageName(packageName: string): boolean {
  return /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(packageName);
}

function assertContained(parent: string, child: string, label: string): string {
  const root = resolve(parent);
  const target = resolve(child);
  const rel = relative(root, target);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return target;
  throw new Error(`${label} resolves outside ${root}`);
}

function packageInstallDir(scopeRoot: string, packageName: string): string {
  if (!isValidNpmPackageName(packageName)) {
    throw new Error(`Invalid npm package name in installed manifest: ${packageName}`);
  }
  return assertContained(
    resolve(scopeRoot, 'node_modules'),
    resolve(scopeRoot, 'node_modules', packageName),
    `Package path for ${packageName}`,
  );
}

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
  if (m.interfaces.command) validateCommandSource(m.interfaces.command, origin);
  if (m.interfaces.orchestrator) validateOrchestratorSource(m.interfaces.orchestrator, origin);
  return m as ManifestSource;
}

function validateCommandSource(config: { commands?: unknown }, origin: string): void {
  const commands = config.commands;
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error(`${origin}: interfaces.command.commands is required`);
  }
  commands.forEach((route: any, index: number) => {
    if (!nonEmptyString(route?.name)) throw new Error(`${origin}: interfaces.command.commands[${index}].name is required`);
    if (!nonEmptyString(route?.command)) throw new Error(`${origin}: interfaces.command.commands[${index}].command is required`);
    if (route.args !== undefined && (!Array.isArray(route.args) || route.args.some((arg: unknown) => typeof arg !== 'string'))) {
      throw new Error(`${origin}: interfaces.command.commands[${index}].args must be an array of strings`);
    }
  });
}

function validateOrchestratorSource(config: { calls?: unknown }, origin: string): void {
  const calls = config.calls;
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error(`${origin}: interfaces.orchestrator.calls is required`);
  }
  calls.forEach((route: any, index: number) => {
    if (!nonEmptyString(route?.name)) throw new Error(`${origin}: interfaces.orchestrator.calls[${index}].name is required`);
    if (Array.isArray(route?.call)) {
      if (route.call.length === 0 || route.call.some((call: unknown) => !nonEmptyString(call))) {
        throw new Error(`${origin}: interfaces.orchestrator.calls[${index}].call must contain non-empty commands`);
      }
      return;
    }
    if (!nonEmptyString(route?.call)) throw new Error(`${origin}: interfaces.orchestrator.calls[${index}].call is required`);
  });
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function loadSourceFromDir(dir: string): Promise<ManifestSource | null> {
  for (const ext of ['.yaml', '.yml', '.json']) {
    const filePath = resolve(dir, `manifest${ext}`);
    if (await exists(filePath)) {
      const text = await readFile(filePath, 'utf-8');
      const raw = ext === '.json' ? JSON.parse(text) : parseYaml(text);
      return absolutizeSource(validateSource(raw, filePath), dir);
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
  const dir = dirname(filePath);
  return { source: absolutizeSource(validateSource(raw, filePath), dir), dir };
}

function absolutizeSource(source: ManifestSource, dir: string): ManifestSource {
  const next: ManifestSource = { ...source, interfaces: { ...source.interfaces } };
  for (const iface of ['api', 'graphql'] as const) {
    const entry = next.interfaces[iface];
    if (!entry) continue;
    next.interfaces[iface] = { ...entry };
    if (entry.spec && !/^[a-z][a-z0-9+.-]*:/i.test(entry.spec) && !isAbsolute(entry.spec)) {
      next.interfaces[iface]!.spec = resolve(dir, entry.spec);
    }
  }
  return next;
}

async function loadSourceFromPackageDir(pkgDir: string): Promise<ManifestSource | null> {
  const pkgPath = resolve(pkgDir, 'package.json');
  if (!(await exists(pkgPath))) return null;
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as {
    exports?: Record<string, string | { default?: string }>;
  };
  const manifestExport = pkg.exports?.['./manifest'];
  const manifestPath = typeof manifestExport === 'string'
    ? manifestExport
    : manifestExport?.default;
  if (!manifestPath) {
    throw new Error(`${pkgPath}: missing exports["./manifest"]`);
  }
  const loaded = await loadSourceFromFile(assertContained(pkgDir, resolve(pkgDir, manifestPath), 'Manifest export'));
  if (!loaded) {
    throw new Error(`${pkgPath}: exports["./manifest"] does not point to a readable manifest`);
  }
  return loaded.source;
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

  // Only "nothing to resolve" falls through to the npm path — a manifest
  // that exists but fails validation should surface its error, not be
  // retried as a package name.
  const resolved = await resolveSource(input).catch((error: unknown) => {
    if (error instanceof Error && error.message.startsWith('No manifest found')) return null;
    throw error;
  });

  if (resolved) {
    const { name, source } = resolved;
    const slug = source.slug || name;
    assertSlugFree(slug, scope);
    const ifaceKeys = Object.keys(source.interfaces).filter((k) =>
      INTERFACE_KEYS.includes(k as InterfaceKey),
    ) as InterfaceKey[];

    if (ifaceKeys.length > 0) {
      const multi: MultiManifest = {
        name: source.name,
        slug,
        description: source.description || '',
        source: 'local',
        auth: source.auth,
        headers: source.headers,
        interfaces: {},
      };

      for (const iface of ifaceKeys) {
        const data = await compileInterface(iface, name, source);
        (multi.interfaces as Record<string, unknown>)[iface] = data;
      }

      await writeFile(resolve(extensionsDir, `${name}.json`), JSON.stringify(multi, null, 2));
      await writeFile(resolve(extensionsDir, `${name}.SKILL.md`), generateSkill(multi));

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
  const asPath = resolve(process.cwd(), input);
  const inputPackageJson = await exists(resolve(asPath, 'package.json'))
    ? JSON.parse(await readFile(resolve(asPath, 'package.json'), 'utf-8')) as { name?: string }
    : null;
  const packageName = inputPackageJson?.name || (input.startsWith('@') ? input : `@godmode-cli/${input}`);
  const name = resolved?.name || (input.startsWith('@') ? basename(input) : input);
  assertSlugFree(name, scope, packageName);
  const installTarget = resolved?.dir && (await exists(resolve(resolved.dir, 'package.json')))
    ? resolved.dir
    : inputPackageJson ? asPath : packageName;

  process.stderr.write(`Installing ${name} [${scope}]...\n`);
  try {
    execFileSync('npm', ['install', installTarget, '--prefix', scopeRoot], { stdio: 'pipe' });
  } catch (e: unknown) {
    const err = e as { stderr?: { toString(): string }; message?: string };
    throw new Error(`Failed to install ${name}: ${err.stderr?.toString().trim() || err.message}`);
  }

  const pkgDir = packageInstallDir(scopeRoot, packageName);
  const packageSource = await loadSourceFromPackageDir(pkgDir).catch((error: unknown) => {
    const mcpConfigPath = resolve(pkgDir, '.mcp.json');
    if (existsSync(mcpConfigPath)) return null;
    throw error;
  });
  if (packageSource) {
    const slug = packageSource.slug || name;
    if (slug !== name) assertSlugFree(slug, scope, packageName);
    const ifaceKeys = Object.keys(packageSource.interfaces).filter((k) =>
      INTERFACE_KEYS.includes(k as InterfaceKey),
    ) as InterfaceKey[];
    const multi: MultiManifest = {
      name: packageSource.name,
      slug,
      description: packageSource.description || '',
      source: 'npm',
      packageName,
      auth: packageSource.auth,
      headers: packageSource.headers,
      interfaces: {},
    };
    for (const iface of ifaceKeys) {
      const data = await compileInterface(iface, slug, packageSource);
      (multi.interfaces as Record<string, unknown>)[iface] = data;
    }
    await writeFile(resolve(extensionsDir, `${slug}.json`), JSON.stringify(multi, null, 2));
    await writeFile(resolve(extensionsDir, `${slug}.SKILL.md`), generateSkill(multi));
    process.stderr.write(`Registered "${slug}" [${scope}] from ${packageName}\n`);
  } else if (await exists(resolve(pkgDir, '.mcp.json'))) {
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
  // Reinstall from the recorded package when the extension came from npm,
  // so scoped/third-party packages update from the right source.
  const existing = findInstalledManifestSync(name);
  await addApi(existing?.packageName ?? name, resolvedScope);
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
  const manifestPath = resolve(dir, `${name}.json`);
  let manifestText: string;
  try {
    manifestText = await readFile(manifestPath, 'utf-8');
  } catch {
    process.stderr.write(`Extension "${name}" not found\n`);
    process.exit(1);
  }
  let packageName: string | undefined;
  try {
    const multi = JSON.parse(manifestText) as MultiManifest;
    packageName = multi.packageName;
  } catch {}
  const packageDir = packageName
    ? packageInstallDir(resolvedScope === 'global' ? GODMODE_HOME : dirname(dir), packageName)
    : null;
  try {
    await unlink(manifestPath);
  } catch {
    process.stderr.write(`Extension "${name}" not found\n`);
    process.exit(1);
  }
  if (packageDir) await rm(packageDir, { recursive: true, force: true });
  const skillPath = resolve(dir, `${name}.SKILL.md`);
  if (await exists(skillPath)) await unlink(skillPath);
  process.stderr.write(`Removed "${name}" [${resolvedScope}]\n`);
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
  const rows: Array<{ scope: Scope; source: string; slug: string; ifaces: string; routeTotal: number; description: string; shadowed: boolean }> = [];
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
        source: m.source || 'local',
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
    console.log(`  ${r.slug}\t${tag}\t${r.source}\t[${r.ifaces}]\t${r.routeTotal} routes${desc}`);
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

export async function readInstalledSkill(name: string): Promise<string | null> {
  for (const scope of ['project', 'global'] as const) {
    const dir = scopeExtensionsDirSync(scope);
    if (!dir) continue;
    const path = resolve(dir, `${name}.SKILL.md`);
    if (!existsSync(path)) continue;
    return readFile(path, 'utf-8');
  }
  return null;
}
