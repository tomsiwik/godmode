import { loadEnv } from './env.js';
import { addApi, removeApi, updateApi, listApis, loadManifest } from './config.js';
import { matchRoute, suggestRoutes } from './match.js';
import { execute } from './request.js';
import { validateGraphQLFlags } from './protocols/graphql.js';
import type { Manifest, Route } from './spec.js';

loadEnv();

// ── arg parsing ─────────────────────────────────────────────

interface ParsedArgs {
  segments: string[];
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, string>;
  token?: string;
  filter?: string;
  methodFilter?: string;
  all: boolean;
  verbose: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const segments: string[] = [];
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  const body: Record<string, string> = {};
  let method = 'get';
  let token: string | undefined;
  let filter: string | undefined;
  let methodFilter: string | undefined;
  let all = false;
  let verbose = false;
  let dryRun = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      // HTTP methods
      case '-g':  case '--get':    method = 'get';    break;
      case '-po': case '--post':   method = 'post';   break;
      case '-pu': case '--put':    method = 'put';    break;
      case '-pa': case '--patch':  method = 'patch';  break;
      case '-d':  case '--delete': method = 'delete'; break;
      case '--head':               method = 'head';   break;
      // Options
      case '-H': case '--header': {
        const val = args[++i];
        const idx = val.indexOf(':');
        if (idx > 0) headers[val.slice(0, idx).trim()] = val.slice(idx + 1).trim();
        break;
      }
      case '--token':              token = args[++i];  break;
      case '--filter':             filter = args[++i];       break;
      case '--method':             methodFilter = args[++i]; break;
      case '--all':                all = true;               break;
      case '-v': case '--verbose': verbose = true;    break;
      case '--dry-run':            dryRun = true;     break;
      case '-h': case '--help':    help = true;       break;
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`Unknown flag: ${arg}\n`);
          process.exit(1);
        }
        // httpie-style: key==value → query, key=value → body
        const eqeq = arg.indexOf('==');
        const eq = arg.indexOf('=');
        if (eqeq > 0) {
          query[arg.slice(0, eqeq)] = arg.slice(eqeq + 2);
        } else if (eq > 0) {
          body[arg.slice(0, eq)] = arg.slice(eq + 1);
        } else {
          segments.push(arg);
        }
    }
  }

  // body fields imply POST if no method was explicitly set
  if (Object.keys(body).length && method === 'get') method = 'post';

  return { segments, method, headers, query, body, token, filter, methodFilter, all, verbose, dryRun, help };
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

Methods:
  -g,  --get                  GET (default)
  -po, --post                 POST
  -pu, --put                  PUT
  -pa, --patch                PATCH
  -d,  --delete               DELETE

Data (httpie-style):
  key=value                   Body field (JSON, implies POST)
  key==value                  Query param (URL)

Options:
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

interface ParamStatus { name: string; provided: boolean; value?: string }
interface NavResult { node: TrieNode; fullPath: string[]; params: ParamStatus[] }

function navigateTrie(root: TrieNode, segments: string[]): NavResult | null {
  let node = root;
  const fullPath: string[] = [];
  const params: ParamStatus[] = [];
  for (const seg of segments) {
    // Direct static child
    const staticChild = node.children.find((c) => !c.isParam && c.name === seg);
    if (staticChild) { fullPath.push(seg); node = staticChild; continue; }
    // Check through param children (folding)
    const paramChild = node.children.find((c) => c.isParam);
    if (paramChild) {
      const nested = paramChild.children.find((c) => !c.isParam && c.name === seg);
      if (nested) {
        // Skipped param — folded through without a value
        fullPath.push(`<${paramChild.name}>`, seg);
        params.push({ name: paramChild.name, provided: false });
        node = nested;
        continue;
      }
      // Param value provided
      fullPath.push(seg);
      params.push({ name: paramChild.name, provided: true, value: seg });
      node = paramChild;
      continue;
    }
    return null;
  }
  return { node, fullPath, params };
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

import fuzzysort from 'fuzzysort';

// Method labels — Swagger UI colors, small caps unicode
const METHOD_LABEL: Record<string, string> = {
  get:    '\x1b[38;5;34mɢᴇᴛ\x1b[0m',      // green
  post:   '\x1b[38;5;25mᴘᴏꜱᴛ\x1b[0m',     // blue
  put:    '\x1b[38;5;172mᴘᴜᴛ\x1b[0m',     // orange
  patch:  '\x1b[38;5;30mᴘᴀᴛᴄʜ\x1b[0m',    // teal
  delete: '\x1b[38;5;160mᴅᴇʟᴇᴛᴇ\x1b[0m',  // red
};

function methodLabels(node: TrieNode): string {
  // Collect actual HTTP methods from this node + folded param child
  const methods = new Set<string>();
  for (const ep of node.methods) methods.add(ep.method);
  const paramChild = node.children.find((c) => c.isParam);
  if (paramChild) for (const ep of paramChild.methods) methods.add(ep.method);
  const order = ['get', 'post', 'put', 'patch', 'delete'];
  return order.filter((m) => methods.has(m)).map((m) => METHOD_LABEL[m]).join(' ');
}

/** Unified --help at any level */
function showHelp2(manifest: Manifest, apiName: string, path: string[], filter?: string, methodFilter?: string, all?: boolean) {
  const root = buildTrie(manifest.routes);
  const nav = navigateTrie(root, path);
  if (!nav) { console.log('No matching resource.'); return; }
  const { node, fullPath } = nav;

  const actions = getNodeActions(node);
  const param = getParamName(node);
  const children = getChildren(node).filter((c) => !c.isParam);
  const childNames = [...new Set(children.map((c) => c.name))];
  const resourceName = fullPath.join(' ');

  // Header
  if (!path.length) {
    const name = manifest.config.name || apiName;
    const ver = manifest.specVersion ? ` \x1b[2mv${manifest.specVersion}\x1b[0m` : '';
    const desc = manifest.description ? `\n\x1b[2m${manifest.description}\x1b[0m` : '';
    console.log(`${name}${ver}${desc}\n`);
    console.log(`Usage:\n  godmode ${apiName} <resource> [id] [flags]\n`);

    const auth = manifest.config.auth;
    if (auth?.env) {
      const ok = !!process.env[auth.env];
      const status = ok ? '\x1b[32m(token provided)\x1b[0m' : '\x1b[31m(missing token)\x1b[0m';
      console.log(`${auth.env} ${status}\n`);
    }
  } else {
    const paramHint = getParamName(node);
    const idRef = paramHint ? ` [${paramHint}]` : '';
    console.log(`Usage:\n  godmode ${apiName} ${resourceName}${idRef} [flags]\n`);

    const auth = manifest.config.auth;
    if (auth?.env) {
      const ok = !!process.env[auth.env];
      const status = ok ? '\x1b[32m(token provided)\x1b[0m' : '\x1b[31m(missing token)\x1b[0m';
      console.log(`${auth.env} ${status}`);
    }

    for (const p of nav.params) {
      const status = p.provided
        ? `\x1b[32m(${p.value})\x1b[0m`
        : '\x1b[31m(missing parameter)\x1b[0m';
      console.log(`<${p.name}> ${status}`);
    }
    console.log('');

    const order = ['get', 'post', 'put', 'patch', 'delete'] as const;
    const pc = node.children.find((c) => c.isParam);
    const paramRef = pc ? `<${pc.name}>` : '';

    // Collect endpoints grouped by collection vs resource
    const rows: Array<{ method: string; summary: string; needsId: boolean }> = [];
    for (const ep of node.methods) {
      rows.push({ method: ep.method, summary: ep.summary, needsId: false });
    }
    if (pc) {
      for (const ep of pc.methods) {
        rows.push({ method: ep.method, summary: ep.summary, needsId: true });
      }
    }

    if (rows.length) {
      const lastSeg = path[path.length - 1] || resourceName;
      const base = lastSeg;
      const lines: Array<{ cmd: string; label: string; desc: string }> = [];

      for (const m of order) {
        for (const r of rows.filter((r) => r.method === m)) {
          const id = r.needsId ? ` <${pc!.name}>` : '';
          let suffix = '';
          if (m === 'post' || m === 'put' || m === 'patch') suffix = ' key=val';
          if (m === 'delete') suffix = ' -d';
          // For non-default methods on collection, add flag
          const needsFlag = (!r.needsId && m !== 'get' && m !== 'post') || (r.needsId && m === 'post');
          const flag = needsFlag ? ` -${m === 'post' ? 'po' : m === 'put' ? 'pu' : m === 'patch' ? 'pa' : ''}` : '';
          const cmd = `${base}${id}${suffix}${flag}`.trim();
          lines.push({ cmd, label: METHOD_LABEL[m] || m, desc: r.summary || '' });
        }
      }

      const maxCmd = Math.max(...lines.map((l) => l.cmd.length));
      for (const l of lines) {
        const desc = l.desc ? `  \x1b[2m${l.desc}\x1b[0m` : '';
        console.log(`  ${l.cmd.padEnd(maxCmd + 2)}${l.label}${desc}`);
      }
      console.log('');
    }
  }

  // Sub-resources
  if (childNames.length) {
    const ALL_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
    const mf = methodFilter
      ? fuzzysort.go(methodFilter, ALL_METHODS)[0]?.target
      : undefined;

    if (methodFilter && !mf) {
      console.log(`\nNo method matching "${methodFilter}".`);
      return;
    }

    // Method filter first
    let candidates = mf
      ? childNames.filter((n) => {
          const child = children.find((c) => c.name === n);
          if (!child) return false;
          const methods = new Set<string>();
          for (const ep of child.methods) methods.add(ep.method);
          const pc = child.children.find((c) => c.isParam);
          if (pc) for (const ep of pc.methods) methods.add(ep.method);
          return methods.has(mf);
        })
      : childNames;

    // Fuzzy name filter
    const filtered = filter
      ? fuzzysort.go(filter, candidates).map((r) => r.target)
      : candidates;

    const prefix = `godmode ${apiName}${resourceName ? ' ' + resourceName : ''}`;
    const label = filter || mf
      ? `Resources${filter ? ` matching "${filter}"` : ''}${mf ? ` with ${mf.toUpperCase()}${methodFilter !== mf ? ` (matched "${methodFilter}")` : ''}` : ''}:`
      : 'Resources:';
    console.log(`\n${label}`);

    if (!filtered.length) {
      console.log('  No matches.');
    } else {
      const limit = (filter || mf || all) ? filtered.length : 5;
      const shown = filtered.slice(0, limit);
      const more = filtered.length - shown.length;

      for (const n of shown) {
        const child = children.find((c) => c.name === n);
        const labels = child ? methodLabels(child) : '';
        const subCount = child ? getChildren(child).filter((c) => !c.isParam).length : 0;
        const sub = subCount ? `  \x1b[2m(${subCount} sub)\x1b[0m` : '';
        const rawDesc = manifest.resourceDescriptions[n] || '';
        const truncated = rawDesc.length > 60 ? rawDesc.slice(0, 57) + '...' : rawDesc;
        const descStr = truncated ? `  \x1b[2m${truncated}\x1b[0m` : '';
        console.log(`  ${n.padEnd(28)}${labels}${sub}${descStr}`);
      }

      if (more) {
        console.log(`  \x1b[2m...${more} more → use --all, --filter or --method\x1b[0m`);
      }
    }

    console.log(`\nUse "${prefix} <resource> --help" for more.`);
  }
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
    showHelp2(manifest, apiName, parsed.segments, parsed.filter, parsed.methodFilter, parsed.all);
    return;
  }

  // ── protocol validation ──

  if (manifest.config.type === 'graphql') {
    const err = validateGraphQLFlags(parsed.method, parsed.query, parsed.body, apiName);
    if (err) { process.stderr.write(err + '\n'); process.exit(1); }
  }

  // ── resolve query + body ──

  const query = parsed.query;
  const hasBody = Object.keys(parsed.body).length > 0;
  let body: string | undefined = hasBody ? JSON.stringify(parsed.body) : undefined;

  if (!body && ['post', 'put', 'patch'].includes(parsed.method)) body = await readStdin();

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
