import { resolve, basename, dirname, extname } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, readFile, writeFile, readdir, unlink, access } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { parseSpec, type ApiConfig, type Manifest } from './spec.js';

export const GODMODE_HOME = process.platform === 'linux' && process.env.XDG_CONFIG_HOME
  ? resolve(process.env.XDG_CONFIG_HOME, 'godmode')
  : resolve(homedir(), '.godmode');
const APIS_DIR = resolve(GODMODE_HOME, 'apis');

async function ensureDirs() {
  await mkdir(APIS_DIR, { recursive: true });
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function loadManifestFromDir(dir: string): Promise<{ config: ApiConfig; ext: string } | null> {
  for (const ext of ['.yaml', '.yml', '.json']) {
    const filePath = resolve(dir, `manifest${ext}`);
    if (await exists(filePath)) {
      const text = await readFile(filePath, 'utf-8');
      const config: ApiConfig = ext === '.json' ? JSON.parse(text) : parseYaml(text);
      return { config, ext };
    }
  }
  return null;
}

async function loadManifestFile(filePath: string): Promise<{ config: ApiConfig; ext: string; dir: string } | null> {
  if (!(await exists(filePath))) return null;
  const ext = extname(filePath);
  if (!['.yaml', '.yml', '.json'].includes(ext)) return null;
  const text = await readFile(filePath, 'utf-8');
  const config: ApiConfig = ext === '.json' ? JSON.parse(text) : parseYaml(text);
  return { config, ext, dir: dirname(filePath) };
}

async function resolveConfig(input: string): Promise<{ name: string; config: ApiConfig; dir: string }> {
  const asPath = resolve(process.cwd(), input);

  // Check input as a direct manifest file path
  const fromFile = await loadManifestFile(asPath);
  if (fromFile) return { name: fromFile.config.slug || basename(fromFile.dir), config: fromFile.config, dir: fromFile.dir };

  // Check input as a folder path containing manifest.yaml
  const fromDir = await loadManifestFromDir(asPath);
  if (fromDir) return { name: fromDir.config.slug || basename(asPath), config: fromDir.config, dir: asPath };

  // Check installed @godmode-cli/<input> adapter
  try {
    const pkgDir = resolve(import.meta.dirname, '..', '..', '..', 'adapters', input);
    const fromPkg = await loadManifestFromDir(pkgDir);
    if (fromPkg) return { name: fromPkg.config.slug || input, config: fromPkg.config, dir: pkgDir };
  } catch {}

  throw new Error(`No config found: ${input} (expected manifest file, folder containing manifest.yaml, or @godmode-cli/${input})`);
}

export async function addApi(input: string) {
  await ensureDirs();

  // Try to resolve as a folder with manifest.yaml
  const resolved = await resolveConfig(input).catch(() => null);

  if (resolved) {
    const { name, config } = resolved;
    const type = config.type;

    // No type = package-based adapter, fall through to npm install
    if (type && ['api', 'graphql', 'mcp'].includes(type)) {
      if (type === 'api' && !config.spec) throw new Error('Config missing "spec" (OpenAPI spec URL or path)');
      if (type === 'graphql' && !config.spec && !config.url) throw new Error('GraphQL config needs "spec" (SDL) or "url" (for introspection)');
      if (type === 'mcp' && !config.url) throw new Error('MCP config needs "url" (MCP endpoint)');
      if (!config.url && type === 'api') process.stderr.write('Warning: no "url" in config - will try to detect from spec\n');

      const manifest = await parseSpec(name, config);
      await writeFile(resolve(APIS_DIR, `${name}.json`), JSON.stringify(manifest, null, 2));
      const urlNote = manifest.config.url ? ` at ${manifest.config.url}` : '';
      process.stderr.write(`Registered "${name}" - ${manifest.routes.length} routes${urlNote}\n`);
      return;
    }
  }

  // Package-based adapter - install via npm
  const name = resolved?.name || input;
  const installTarget = resolved?.dir && (await exists(resolve(resolved.dir, 'package.json')))
    ? resolved.dir
    : (input.startsWith('@') ? input : `@godmode-cli/${input}`);

  process.stderr.write(`Installing ${name}...\n`);
  try {
    execSync(`npm install ${installTarget} --prefix ${GODMODE_HOME}`, { stdio: 'pipe' });
  } catch (e: any) {
    throw new Error(`Failed to install ${name}: ${e.stderr?.toString().trim() || e.message}`);
  }

  const pkgName = `@godmode-cli/${name}`;
  const mcpConfigPath = resolve(GODMODE_HOME, 'node_modules', pkgName, '.mcp.json');
  if (await exists(mcpConfigPath)) {
    process.stderr.write(`Installed "${name}" (MCP server adapter)\n`);
  } else {
    process.stderr.write(`Installed "${name}"\n`);
  }
}

export async function updateApi(name: string) {
  await ensureDirs();
  const manifest = await loadManifestFromDir(name);
  process.stderr.write(`Updating "${name}"...\n`);
  const updated = await parseSpec(name, manifest.config);
  await writeFile(resolve(APIS_DIR, `${name}.json`), JSON.stringify(updated, null, 2));
  process.stderr.write(`Updated "${name}" - ${updated.routes.length} routes\n`);
}

export async function removeApi(name: string) {
  try {
    await unlink(resolve(APIS_DIR, `${name}.json`));
    process.stderr.write(`Removed "${name}"\n`);
  } catch {
    process.stderr.write(`API "${name}" not found\n`);
    process.exit(1);
  }
}

export async function listApis() {
  await ensureDirs();
  const files = await readdir(APIS_DIR);
  const apis = files.filter((f) => f.endsWith('.json'));
  if (!apis.length) {
    console.log('No APIs registered. Create a <name>.yaml config and run: godmode add <name>');
    return;
  }
  for (const file of apis) {
    const m: Manifest = JSON.parse(await readFile(resolve(APIS_DIR, file), 'utf-8'));
    const ver = m.specVersion ? ` v${m.specVersion}` : '';
    const desc = m.description ? `  ${m.description}` : '';
    const url = m.config.url || '(local)';
    console.log(`  ${m.name}${ver}\t${url}\t${m.routes.length} routes${desc}`);
  }
}

export async function loadManifest(name: string): Promise<Manifest> {
  await ensureDirs();
  try {
    return JSON.parse(await readFile(resolve(APIS_DIR, `${name}.json`), 'utf-8'));
  } catch {
    process.stderr.write(`API "${name}" not found. Create ${name}.yaml and run: godmode add ${name}\n`);
    process.exit(1);
  }
}
