import { loadEnv } from './env.js';
import { addApi, removeApi, updateApi, listApis, loadManifest } from './config.js';
import { matchRoute, suggestRoutes } from './match.js';
import { execute } from './request.js';
import type { Manifest, Route } from './spec.js';

loadEnv();

// ── arg parsing ─────────────────────────────────────────────

interface ParsedArgs {
  segments: string[];
  method: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  token?: string;
  verbose: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const segments: string[] = [];
  const headers: Record<string, string> = {};
  const params: Record<string, string> = {};
  let method = 'get';
  let token: string | undefined;
  let verbose = false;
  let dryRun = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-d': case '--delete':  method = 'delete'; break;
      case '--put':                method = 'put';    break;
      case '--patch':              method = 'patch';  break;
      case '--post':               method = 'post';   break;
      case '--head':               method = 'head';   break;
      case '-H': case '--header': {
        const val = args[++i];
        const idx = val.indexOf(':');
        if (idx > 0) headers[val.slice(0, idx).trim()] = val.slice(idx + 1).trim();
        break;
      }
      case '-q': case '--data': {
        const val = args[++i];
        const idx = val.indexOf('=');
        if (idx > 0) params[val.slice(0, idx)] = val.slice(idx + 1);
        break;
      }
      case '--token':              token = args[++i]; break;
      case '-v': case '--verbose': verbose = true;    break;
      case '--dry-run':            dryRun = true;     break;
      case '-h': case '--help':    help = true;       break;
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`Unknown flag: ${arg}\n`);
          process.exit(1);
        }
        segments.push(arg);
    }
  }

  return { segments, method, headers, params, token, verbose, dryRun, help };
}

// ── stdin ───────────────────────────────────────────────────

async function readStdin(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf-8').trim();
  return text || undefined;
}

// ── help ────────────────────────────────────────────────────

function showHelp() {
  console.log(`ɢᴏᴅᴍᴏᴅᴇ
\x1b[2mbetter than mcp\x1b[0m

Usage:
  godmode <api> <resource> [id] [flags]
  godmode <api> /path [flags]

Setup:
  create                      Create own custom API entrypoint
  add <name|file>             Add API as CLI command from <name>.yaml config
  update <name>               Re-fetch OpenAPI spec and rebuild routes
  remove <name>               Unregister an API
  list                        Show all registered APIs
  ...                         Run \x1b[2mgodmode add --help\x1b[0m for config format

Navigation:
  <api> info                  List available resources
  <api> <resource> info       List sub-resources
  <api> <resource> --help     Show actions for a resource
  <api> <action> --help       Show resources supporting an action

Flags:
      --post                  POST
      --put                   PUT
      --patch                 PATCH
  -d, --delete                DELETE
  -q  <key=value>             Query (GET) or body (POST/PUT/PATCH)
  -H  <key:value>             Add header
      --token <tok>            Auth token (overrides config)
      --dry-run                Preview request without sending
  -v, --verbose                Show full request/response

Use "godmode <api> --help" for API-specific usage.`);
}

// ── navigation ──────────────────────────────────────────────

interface TrieNode {
  name: string;
  isParam: boolean;
  methods: Array<{ method: string; summary: string }>;
  children: TrieNode[];
}

const ACTION_ORDER = ['list', 'create', 'get', 'update', 'delete'];
const ACTIONS = new Set(ACTION_ORDER);

function buildTrie(routes: Route[]): TrieNode {
  const root: TrieNode = { name: '', isParam: false, methods: [], children: [] };
  for (const route of routes) {
    let node = root;
    for (const seg of route.segments) {
      let child = node.children.find((c) => c.name === seg.value && c.isParam === seg.isParam);
      if (!child) {
        child = { name: seg.value, isParam: seg.isParam, methods: [], children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.methods.push({ method: route.method, summary: route.summary });
  }
  return root;
}

function navigateTrie(root: TrieNode, segments: string[]): TrieNode | null {
  let node = root;
  for (const seg of segments) {
    const staticChild = node.children.find((c) => !c.isParam && c.name === seg);
    if (staticChild) { node = staticChild; continue; }
    const paramChild = node.children.find((c) => c.isParam);
    if (paramChild) { node = paramChild; continue; }
    return null;
  }
  return node;
}

function getChildren(node: TrieNode): TrieNode[] {
  const statics = node.children.filter((c) => !c.isParam);
  const params = node.children.filter((c) => c.isParam);
  const result = [...statics];
  for (const p of params) result.push(...p.children);
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function methodToAction(method: string, isResource: boolean): string {
  switch (method) {
    case 'get':               return isResource ? 'get' : 'list';
    case 'post':              return isResource ? 'update' : 'create';
    case 'put': case 'patch': return 'update';
    case 'delete':            return 'delete';
    default:                  return method;
  }
}

function getNodeActions(node: TrieNode): string[] {
  const actions = new Set<string>();
  const paramChild = node.children.find((c) => c.isParam);
  const isLeaf = !paramChild;
  for (const ep of node.methods) actions.add(methodToAction(ep.method, isLeaf));
  if (paramChild) {
    for (const ep of paramChild.methods) actions.add(methodToAction(ep.method, true));
  }
  return [...actions].sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b));
}

function getParamName(node: TrieNode): string | null {
  return node.children.find((c) => c.isParam)?.name || null;
}

function getNodeSummary(node: TrieNode): string {
  const get = node.methods.find((m) => m.method === 'get');
  if (get?.summary) return get.summary;
  if (node.methods[0]?.summary) return node.methods[0].summary;
  const p = node.children.find((c) => c.isParam);
  return p?.methods.find((m) => m.method === 'get')?.summary || p?.methods[0]?.summary || '';
}

function formatColumns(items: string[], maxWidth = 76): string {
  if (!items.length) return '';
  const maxLen = Math.max(...items.map((s) => s.length));
  const colWidth = maxLen + 3;
  const cols = Math.max(1, Math.floor(maxWidth / colWidth));
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += cols) {
    lines.push('  ' + items.slice(i, i + cols).map((s) => s.padEnd(colWidth)).join('').trimEnd());
  }
  return lines.join('\n');
}

/** `godmode stripe --help` — full usage guide */
function showApiCommandHelp(manifest: Manifest, apiName: string) {
  const name = manifest.config.name || apiName;
  const ver = manifest.specVersion ? ` v${manifest.specVersion}` : '';
  const desc = manifest.description || '';

  console.log(`${name}${ver}${desc ? ' — ' + desc : ''}

Usage:
  godmode ${apiName} <resource> [id] [flags]
  godmode ${apiName} /path [flags]

Navigation:
  info                        Resources
  <resource> info             Sub-resources
  <resource> --help           Actions
  <action> --help             Filter by action (list, create, get, update, delete)

Examples:
  ${apiName} customers                          List
  ${apiName} customers cus_123                  Get
  ${apiName} customers --post -q email=a@b.com  Create
  ${apiName} customers cus_123 -d               Delete
  ${apiName} /v1/customers                      Raw path`);
}

/** `godmode stripe customers --help` — actions and sub-resources for a resource */
function showResourceHelp(manifest: Manifest, apiName: string, path: string[]) {
  const root = buildTrie(manifest.routes);
  const node = navigateTrie(root, path);
  if (!node) { console.log('No matching resource.'); return; }

  const actions = getNodeActions(node);
  const param = getParamName(node);
  const summary = getNodeSummary(node);
  const resourceName = path.join(' ');
  const children = getChildren(node).filter((c) => !c.isParam);
  const childNames = [...new Set(children.map((c) => c.name))];

  console.log(`${resourceName}${summary ? ' — ' + summary : ''}\n`);

  if (actions.length) {
    console.log('Actions:');
    const ref = param ? ` <${param}>` : '';
    const base = `godmode ${apiName} ${resourceName}`;
    for (const a of actions) {
      let ex: string;
      switch (a) {
        case 'list':   ex = base; break;
        case 'get':    ex = `${base}${ref}`; break;
        case 'create': ex = `${base} --post -q key=val`; break;
        case 'update': ex = `${base}${ref} --post -q key=val`; break;
        case 'delete': ex = `${base}${ref} -d`; break;
        default:       ex = base;
      }
      console.log(`  ${a.padEnd(22)}${ex}`);
    }
  }

  if (childNames.length) {
    console.log('\nSub-resources:');
    console.log(formatColumns(childNames));
  }
}

/** `godmode stripe info` — list resource names */
function showResources(manifest: Manifest, path: string[]) {
  const root = buildTrie(manifest.routes);
  const node = navigateTrie(root, path);
  if (!node) { console.log('No matching resource.'); return; }

  const children = getChildren(node).filter((c) => !c.isParam);
  const names = [...new Set(children.map((c) => c.name))];
  if (!names.length) { console.log('No sub-resources.'); return; }
  console.log(formatColumns(names));
}

/** `godmode stripe list --help` — resources supporting an action */
function showActionResources(manifest: Manifest, path: string[], action: string) {
  const root = buildTrie(manifest.routes);
  const node = navigateTrie(root, path);
  if (!node) { console.log('No matching resource.'); return; }

  const children = getChildren(node).filter((c) => !c.isParam);
  const names: string[] = [];
  for (const child of children) {
    if (getNodeActions(child).includes(action)) names.push(child.name);
  }
  const unique = [...new Set(names)];
  if (!unique.length) { console.log(`No resources with "${action}".`); return; }
  console.log(formatColumns(unique));
}

// ── main ────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (!args.length || (args.length === 1 && (args[0] === '-h' || args[0] === '--help'))) {
    showHelp();
    return;
  }

  const cmd = args[0];

  // ── management commands ──

  if (cmd === 'create') {
    const { configWizard } = await import('./prompt.js');
    await configWizard();
    return;
  }

  if (cmd === 'add') {
    if (!args[1] || args[1] === '--help' || args[1] === '-h') {
      console.log(`Add an API as a CLI command from a config file.

Usage:
  godmode add <name>          Looks for <name>.yaml in current directory
  godmode add <path>          Load config from a specific file

Config format (<name>.yaml):
  name:    Stripe             Display name
  description: Payments API   Short description
  type:    api                Type (api, future: grpc, docker, cli)
  spec:    <url>              OpenAPI spec URL or local file
  url:     <base-url>         API base URL
  auth:
    env:   STRIPE_API_KEY     Environment variable for auth token
    type:  bearer             Auth type (bearer, api-key, basic)
  headers:
    X-Custom: value           Default headers for every request

Example:
  $ echo 'name: Stripe
  type: api
  spec: https://raw.githubusercontent.com/.../openapi.yaml
  url: https://api.stripe.com
  auth:
    env: STRIPE_API_KEY' > stripe.yaml
  $ godmode add stripe`);
      process.exit(args[1] ? 0 : 1);
    }
    await addApi(args[1]);
    return;
  }

  if (cmd === 'update') {
    if (!args[1]) { console.error('Usage: godmode update <name>'); process.exit(1); }
    await updateApi(args[1]);
    return;
  }

  if (cmd === 'remove') {
    if (!args[1]) { console.error('Usage: godmode remove <name>'); process.exit(1); }
    await removeApi(args[1]);
    return;
  }

  if (cmd === 'list') {
    await listApis();
    return;
  }

  // ── API call ──

  const apiName = cmd;
  const parsed = parseArgs(args.slice(1));
  const manifest = await loadManifest(apiName);

  // `godmode stripe info` or `godmode stripe customers info`
  const lastSeg = parsed.segments[parsed.segments.length - 1];
  if (lastSeg === 'info') {
    showResources(manifest, parsed.segments.slice(0, -1));
    return;
  }

  // `godmode stripe --help` → full usage guide
  // `godmode stripe customers --help` → resource-specific help
  // `godmode stripe list --help` → resources supporting that action
  if (parsed.help) {
    if (lastSeg && ACTIONS.has(lastSeg)) {
      showActionResources(manifest, parsed.segments.slice(0, -1), lastSeg);
    } else if (parsed.segments.length) {
      showResourceHelp(manifest, apiName, parsed.segments);
    } else {
      showApiCommandHelp(manifest, apiName);
    }
    return;
  }

  // No segments → full usage guide
  if (!parsed.segments.length) {
    showApiCommandHelp(manifest, apiName);
    return;
  }

  // ── resolve params → query or body ──

  const isWrite = ['post', 'put', 'patch'].includes(parsed.method);
  let query: Record<string, string> = {};
  let body: string | undefined;

  if (isWrite && Object.keys(parsed.params).length) {
    body = JSON.stringify(parsed.params);
  } else {
    query = parsed.params;
  }

  if (!body && isWrite) body = await readStdin();

  // ── raw path mode: godmode stripe /v1/customers ──

  if (parsed.segments[0]?.startsWith('/')) {
    const rawPath = parsed.segments[0];
    const syntheticRoute: Route = { path: rawPath, method: parsed.method, summary: '', version: '', segments: [] };
    await execute(manifest, { route: syntheticRoute, params: {} }, {
      headers: parsed.headers, query, body, token: parsed.token,
      verbose: parsed.verbose, dryRun: parsed.dryRun,
    });
    return;
  }

  // ── route matching ──

  const match = matchRoute(manifest, parsed.segments, parsed.method);

  if (!match) {
    process.stderr.write(`No ${parsed.method.toUpperCase()} route matching: ${parsed.segments.join(' ')}\n`);

    for (const m of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      if (m === parsed.method) continue;
      const alt = matchRoute(manifest, parsed.segments, m);
      if (alt) {
        const flag = m === 'delete' ? '-d' : `--${m}`;
        process.stderr.write(`  try: godmode ${apiName} ${parsed.segments.join(' ')} ${flag}\n`);
      }
    }

    const similar = suggestRoutes(manifest, parsed.segments).slice(0, 5);
    if (similar.length) {
      process.stderr.write('\nSimilar:\n');
      const seen = new Set<string>();
      for (const r of similar) {
        const p = r.segments.map((s) => (s.isParam ? `{${s.value}}` : s.value)).join(' ');
        if (seen.has(p)) continue;
        seen.add(p);
        process.stderr.write(`  ${p}\n`);
      }
    }

    process.exit(1);
  }

  await execute(manifest, match, {
    headers: parsed.headers, query, body, token: parsed.token,
    verbose: parsed.verbose, dryRun: parsed.dryRun,
  });
}

main().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
