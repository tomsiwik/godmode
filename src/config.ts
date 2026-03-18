import { resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, readFile, writeFile, readdir, unlink, access } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { parseSpec, type ApiConfig, type Manifest } from './spec.js';

const GODMODE_HOME = process.platform === 'linux' && process.env.XDG_CONFIG_HOME
  ? resolve(process.env.XDG_CONFIG_HOME, 'godmode')
  : resolve(homedir(), '.godmode');
const APIS_DIR = resolve(GODMODE_HOME, 'apis');

async function ensureDirs() {
  await mkdir(APIS_DIR, { recursive: true });
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function resolveConfig(input: string): Promise<{ name: string; config: ApiConfig }> {
  // Direct file path
  if (input.endsWith('.yaml') || input.endsWith('.yml') || input.endsWith('.json')) {
    const filePath = resolve(input);
    const name = basename(filePath).replace(/\.(ya?ml|json)$/, '');
    const text = await readFile(filePath, 'utf-8');
    const config: ApiConfig = filePath.endsWith('.json') ? JSON.parse(text) : parseYaml(text);
    return { name, config };
  }

  // Look for <name>.yaml / .yml / .json in cwd
  const name = input;
  for (const ext of ['.yaml', '.yml', '.json']) {
    const filePath = resolve(process.cwd(), `${name}${ext}`);
    if (await exists(filePath)) {
      const text = await readFile(filePath, 'utf-8');
      const config: ApiConfig = ext === '.json' ? JSON.parse(text) : parseYaml(text);
      return { name, config };
    }
  }

  throw new Error(`No config found: ${name}.yaml or ${name}.json in current directory`);
}

export async function addApi(input: string) {
  await ensureDirs();
  const { name, config } = await resolveConfig(input);

  const type = config.type || 'api';
  if (!['api', 'graphql', 'mcp'].includes(type)) throw new Error(`Unsupported type "${type}" — supported: api, graphql, mcp`);
  config.type = type;

  if (type === 'api' && !config.spec) throw new Error('Config missing "spec" (OpenAPI spec URL or path)');
  if (type === 'graphql' && !config.spec && !config.url) throw new Error('GraphQL config needs "spec" (SDL) or "url" (for introspection)');
  if (type === 'mcp' && !config.url) throw new Error('MCP config needs "url" (MCP endpoint)');
  if (!config.url && type === 'api') process.stderr.write('Warning: no "url" in config — will try to detect from spec\n');

  const manifest = await parseSpec(name, config);
  await writeFile(resolve(APIS_DIR, `${name}.json`), JSON.stringify(manifest, null, 2));
  process.stderr.write(`Registered "${name}" — ${manifest.routes.length} routes at ${manifest.config.url}\n`);
}

export async function updateApi(name: string) {
  await ensureDirs();
  const manifest = await loadManifest(name);
  process.stderr.write(`Updating "${name}"...\n`);
  const updated = await parseSpec(name, manifest.config);
  await writeFile(resolve(APIS_DIR, `${name}.json`), JSON.stringify(updated, null, 2));
  process.stderr.write(`Updated "${name}" — ${updated.routes.length} routes\n`);
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
    console.log(`  ${m.name}${ver}\t${m.config.url}\t${m.routes.length} routes${desc}`);
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
