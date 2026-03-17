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
  <api> --help                Show resources, auth, and usage
  <api> <resource> --help     Show operations and sub-resources

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
    // Direct static child
    const staticChild = node.children.find((c) => !c.isParam && c.name === seg);
    if (staticChild) { node = staticChild; continue; }
    // Check through param children (folding)
    const paramChild = node.children.find((c) => c.isParam);
    if (paramChild) {
      const nested = paramChild.children.find((c) => !c.isParam && c.name === seg);
      if (nested) { node = nested; continue; }
      // Treat as param value
      node = paramChild;
      continue;
    }
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

/** Unified --help at any level */
function showHelp2(manifest: Manifest, apiName: string, path: string[]) {
  const root = buildTrie(manifest.routes);
  const node = navigateTrie(root, path);
  if (!node) { console.log('No matching resource.'); return; }

  const actions = getNodeActions(node);
  const param = getParamName(node);
  const children = getChildren(node).filter((c) => !c.isParam);
  const childNames = [...new Set(children.map((c) => c.name))];
  const resourceName = path.join(' ');

  // Header
  if (!path.length) {
    const name = manifest.config.name || apiName;
    const ver = manifest.specVersion ? ` \x1b[2mv${manifest.specVersion}\x1b[0m` : '';
    const desc = manifest.description ? `\n\x1b[2m${manifest.description}\x1b[0m` : '';
    console.log(`${name}${ver}${desc}\n`);
    console.log(`Usage:\n  godmode ${apiName} <resource> [id] [flags]\n`);

    const auth = manifest.config.auth;
    if (auth?.env) {
      const type = auth.type || 'bearer';
      const set = process.env[auth.env] ? '\x1b[32mset\x1b[0m' : '\x1b[31mnot set\x1b[0m';
      console.log(`Auth: ${type} via ${auth.env} (${set})\n`);
    }
  } else {
    const summary = getNodeSummary(node);
    console.log(`Usage:\n  godmode ${apiName} ${resourceName} <operation> [parameters...]\n`);
    if (summary) console.log(`${summary}\n`);
  }

  // Actions
  if (actions.length) {
    console.log('Available operations:');
    const ref = param ? ` <${param}>` : '';
    for (const a of actions) {
      let usage = '';
      switch (a) {
        case 'list':   usage = `godmode ${apiName} ${resourceName}`.trim(); break;
        case 'get':    usage = `godmode ${apiName} ${resourceName}${ref}`.trim(); break;
        case 'create': usage = `godmode ${apiName} ${resourceName} --post -q key=val`.trim(); break;
        case 'update': usage = `godmode ${apiName} ${resourceName}${ref} --post -q key=val`.trim(); break;
        case 'delete': usage = `godmode ${apiName} ${resourceName}${ref} -d`.trim(); break;
        default:       usage = '';
      }
      console.log(`  ${a.padEnd(24)}${usage}`);
    }
  }

  // Sub-resources
  if (childNames.length) {
    const shown = childNames.slice(0, 5);
    const more = childNames.length > 5 ? childNames.length - 5 : 0;
    console.log(`\nResources:`);
    for (const name of shown) {
      const child = children.find((c) => c.name === name);
      const childActions = child ? getNodeActions(child) : [];
      const ops = childActions.length ? `(${childActions.join(', ')})` : '';
      console.log(`  ${name.padEnd(28)}${ops}`);
    }
    if (more) console.log(`  ...                         ${more} more — run "godmode ${apiName} ${resourceName} <resource> --help"`);
  }

  console.log(`\nUse "godmode ${apiName} ${resourceName ? resourceName + ' ' : ''}<resource> --help" for more.`);
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

  // --help at any level
  if (parsed.help || !parsed.segments.length) {
    showHelp2(manifest, apiName, parsed.segments);
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
