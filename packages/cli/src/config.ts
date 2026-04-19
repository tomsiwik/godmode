import { resolve, basename, dirname, extname } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, readFile, writeFile, readdir, unlink, access } from 'node:fs/promises';
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

export const GODMODE_HOME = process.platform === 'linux' && process.env.XDG_CONFIG_HOME
  ? resolve(process.env.XDG_CONFIG_HOME, 'godmode')
  : resolve(homedir(), '.godmode');
const APIS_DIR = resolve(GODMODE_HOME, 'apis');

const INTERFACE_KEYS: readonly InterfaceKey[] = ['api', 'graphql', 'mcp'] as const;

async function ensureDirs() {
  await mkdir(APIS_DIR, { recursive: true });
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

export async function addApi(input: string) {
  await ensureDirs();

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

      await writeFile(resolve(APIS_DIR, `${name}.json`), JSON.stringify(multi, null, 2));

      const ifaceSummary = ifaceKeys
        .map((k) => {
          const d = multi.interfaces[k];
          return d ? `${k}=${d.routes.length}` : k;
        })
        .join(', ');
      process.stderr.write(`Registered "${name}" - interfaces: ${ifaceSummary}\n`);
      return;
    }
  }

  // Package-based extension (no `interfaces` key) - install via npm
  const name = resolved?.name || input;
  const installTarget = resolved?.dir && (await exists(resolve(resolved.dir, 'package.json')))
    ? resolved.dir
    : (input.startsWith('@') ? input : `@godmode-cli/${input}`);

  process.stderr.write(`Installing ${name}...\n`);
  try {
    execSync(`npm install ${installTarget} --prefix ${GODMODE_HOME}`, { stdio: 'pipe' });
  } catch (e: unknown) {
    const err = e as { stderr?: { toString(): string }; message?: string };
    throw new Error(`Failed to install ${name}: ${err.stderr?.toString().trim() || err.message}`);
  }

  const pkgName = `@godmode-cli/${name}`;
  const mcpConfigPath = resolve(GODMODE_HOME, 'node_modules', pkgName, '.mcp.json');
  if (await exists(mcpConfigPath)) {
    process.stderr.write(`Installed "${name}" (MCP server extension)\n`);
  } else {
    process.stderr.write(`Installed "${name}"\n`);
  }
}

export async function updateApi(name: string) {
  // Re-register by re-resolving + re-compiling.
  await addApi(name);
}

export async function removeApi(name: string) {
  try {
    await unlink(resolve(APIS_DIR, `${name}.json`));
    process.stderr.write(`Removed "${name}"\n`);
  } catch {
    process.stderr.write(`Extension "${name}" not found\n`);
    process.exit(1);
  }
}

export async function listApis() {
  await ensureDirs();
  const files = await readdir(APIS_DIR);
  const apis = files.filter((f) => f.endsWith('.json'));
  if (!apis.length) {
    console.log('No extensions registered. Create a manifest.yaml and run: godmode extension add <name>');
    return;
  }
  for (const file of apis) {
    const m: MultiManifest = JSON.parse(await readFile(resolve(APIS_DIR, file), 'utf-8'));
    const ifaces = Object.keys(m.interfaces).join(', ');
    const desc = m.description ? `  ${m.description}` : '';
    const routeTotal = Object.values(m.interfaces).reduce((n, d) => n + (d?.routes.length ?? 0), 0);
    console.log(`  ${m.slug}\t[${ifaces}]\t${routeTotal} routes${desc}`);
  }
}

export async function loadMultiManifest(name: string): Promise<MultiManifest> {
  await ensureDirs();
  try {
    return JSON.parse(await readFile(resolve(APIS_DIR, `${name}.json`), 'utf-8'));
  } catch {
    process.stderr.write(`Extension "${name}" not found. Create ${name}.yaml and run: godmode extension add ${name}\n`);
    process.exit(1);
  }
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
