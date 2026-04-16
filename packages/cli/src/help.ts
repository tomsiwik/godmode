import fuzzysort from 'fuzzysort';
import type { Manifest, Route } from './spec.js';

// ── trie ────────────────────────────────────────────────────

export interface TrieNode {
  name: string;
  isParam: boolean;
  methods: Array<{ method: string; summary: string }>;
  children: TrieNode[];
}

interface ParamStatus { name: string; provided: boolean; value?: string }
interface NavResult { node: TrieNode; fullPath: string[]; params: ParamStatus[] }

export function buildTrie(routes: Route[]): TrieNode {
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

export function navigateTrie(root: TrieNode, segments: string[]): NavResult | null {
  let node = root;
  const fullPath: string[] = [];
  const params: ParamStatus[] = [];
  for (const seg of segments) {
    const staticChild = node.children.find((c) => !c.isParam && c.name === seg);
    if (staticChild) { fullPath.push(seg); node = staticChild; continue; }
    const paramChild = node.children.find((c) => c.isParam);
    if (paramChild) {
      const nested = paramChild.children.find((c) => !c.isParam && c.name === seg);
      if (nested) {
        fullPath.push(`<${paramChild.name}>`, seg);
        params.push({ name: paramChild.name, provided: false });
        node = nested;
        continue;
      }
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

// ── formatting ──────────────────────────────────────────────

const ACTION_ORDER = ['list', 'create', 'get', 'update', 'delete'];

const METHOD_LABEL: Record<string, string> = {
  get:    '\x1b[1;38;5;34mGET\x1b[0m',
  post:   '\x1b[1;38;5;25mPOST\x1b[0m',
  put:    '\x1b[1;38;5;172mPUT\x1b[0m',
  patch:  '\x1b[1;38;5;30mPATCH\x1b[0m',
  delete: '\x1b[1;38;5;160mDELETE\x1b[0m',
};
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const RESET = '\x1b[0m';

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

function methodLabels(node: TrieNode): string {
  const methods = new Set<string>();
  for (const ep of node.methods) methods.add(ep.method);
  const paramChild = node.children.find((c) => c.isParam);
  if (paramChild) for (const ep of paramChild.methods) methods.add(ep.method);
  const order = ['get', 'post', 'put', 'patch', 'delete'];
  return order.filter((m) => methods.has(m)).map((m) => METHOD_LABEL[m]).join(' ');
}

// ── showHelp ────────────────────────────────────────────────

export function showHelp() {
  console.log(`\u0262\u1d0f\u1d05\u1d0d\u1d0f\u1d05\u1d07
\x1b[2mthe swiss army knife for coding agents\x1b[0m

Usage:
  godmode <interface> <extension> [args]
  godmode extension <command> [args]

Interfaces:
  api <ext> <resource> [id]   REST API call
  graphql <ext> <query>       GraphQL query
  mcp <ext>                   Serve extension as MCP server (stdio)
  skill <ext>                 Load agentic skill

Commands:
  agent ...                   Coding-agent workflows (start/send/attach/output/status)

Extension management:
  extension add <name|file>   Install an extension
  extension remove <name>     Uninstall an extension
  extension update <name>     Re-fetch spec, rebuild routes
  extension list              Show installed extensions
  extension info <name>       Show extension details and interfaces
  extension create            Interactive manifest wizard

Navigation:
  api <ext> --help            Show resources, auth, and usage
  api <ext> <resource> --help Show operations and sub-resources

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

Use "godmode api <ext> --help" for extension-specific usage.`);
}

// ── showApiHelp ─────────────────────────────────────────────

export function showApiHelp(manifest: Manifest, apiName: string, path: string[], filter?: string, methodFilter?: string, all?: boolean) {
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
    console.log(`Usage:\n  godmode api ${apiName} <resource> [id] [flags]\n`);

    const auth = manifest.config.auth;
    if (auth?.env) {
      const ok = !!process.env[auth.env];
      const status = ok ? '\x1b[32m(token provided)\x1b[0m' : '\x1b[31m(missing token)\x1b[0m';
      console.log(`${auth.env} ${status}\n`);
    }
  } else {
    const paramHint = getParamName(node);
    const idRef = paramHint ? ` [${paramHint}]` : '';
    console.log(`Usage:\n  godmode api ${apiName} ${resourceName}${idRef} [flags]\n`);

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

    // MCP tools: show input params from schema
    const mcpTools = (manifest.config as any)._mcpTools as Array<{ name: string; description?: string; inputSchema?: any }> | undefined;
    const mcpTool = mcpTools?.find((t) => t.name === path[path.length - 1]);

    if (mcpTool?.inputSchema?.properties) {
      const props = mcpTool.inputSchema.properties as Record<string, { type: string; description?: string }>;
      const required = new Set<string>(mcpTool.inputSchema.required || []);
      const toolName = mcpTool.name;

      if (mcpTool.description) {
        const first = mcpTool.description.split('\n')[0];
        console.log(`${ITALIC}${first}${RESET}\n`);
      }

      console.log('Parameters:');
      for (const [name, schema] of Object.entries(props)) {
        const req = required.has(name) ? `\x1b[1;38;5;160m[REQUIRED]${RESET} ` : '';
        const desc = schema.description ? `${DIM}${ITALIC}${schema.description}${RESET}` : '';
        console.log(`  ${name.padEnd(28)}${req}${desc}`);
      }
      console.log('');
      console.log(`Example:\n  godmode api ${apiName} ${toolName} ${[...required].map((r) => `${r}=...`).join(' ')}`);
      console.log('');
    } else {
      // REST: show method table
      const order = ['get', 'post', 'put', 'patch', 'delete'] as const;
      const pc = node.children.find((c) => c.isParam);

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
            const needsFlag = (!r.needsId && m !== 'get' && m !== 'post') || (r.needsId && m === 'post');
            const flag = needsFlag ? ` -${m === 'post' ? 'po' : m === 'put' ? 'pu' : m === 'patch' ? 'pa' : ''}` : '';
            const cmd = `${base}${id}${suffix}${flag}`.trim();
            lines.push({ cmd, label: METHOD_LABEL[m] || m, desc: r.summary || '' });
          }
        }

        const maxCmd = Math.max(...lines.map((l) => l.cmd.length));
        for (const l of lines) {
          const desc = l.desc ? `  ${ITALIC}${l.desc}${RESET}` : '';
          console.log(`  ${l.cmd.padEnd(maxCmd + 2)}${l.label}${desc}`);
        }
        console.log('');
      }
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

    const filtered = filter
      ? fuzzysort.go(filter, candidates).map((r) => r.target)
      : candidates;

    const prefix = `godmode api ${apiName}${resourceName ? ' ' + resourceName : ''}`;
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
        const sub = subCount ? `  ${DIM}(${subCount} sub)${RESET}` : '';
        const rawDesc = manifest.resourceDescriptions[n] || '';
        const truncated = rawDesc.length > 60 ? rawDesc.slice(0, 57) + '...' : rawDesc;
        const descStr = truncated ? `  ${ITALIC}${truncated}${RESET}` : '';
        console.log(`  ${n.padEnd(28)}${labels}${sub}${descStr}`);
      }

      if (more) {
        console.log(`  \x1b[2m...${more} more \u2192 use --all, --filter or --method\x1b[0m`);
      }
    }

    console.log(`\nUse "${prefix} <resource> --help" for more.`);
  }
}
