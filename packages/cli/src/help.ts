import fuzzysort from 'fuzzysort';
import type { InterfaceKey, Manifest, MultiManifest, Route } from './spec.js';

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

const USE_COLOR = process.stdout.isTTY;
const METHOD_LABEL: Record<string, string> = USE_COLOR
  ? {
      get:    '\x1b[1;38;5;34mGET\x1b[0m',
      post:   '\x1b[1;38;5;25mPOST\x1b[0m',
      put:    '\x1b[1;38;5;172mPUT\x1b[0m',
      patch:  '\x1b[1;38;5;30mPATCH\x1b[0m',
      delete: '\x1b[1;38;5;160mDELETE\x1b[0m',
    }
  : { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE' };
const DIM = USE_COLOR ? '\x1b[2m' : '';
const ITALIC = USE_COLOR ? '\x1b[3m' : '';
const RESET = USE_COLOR ? '\x1b[0m' : '';
const GREEN = USE_COLOR ? '\x1b[32m' : '';
const RED = USE_COLOR ? '\x1b[31m' : '';

const INTERFACE_LABEL: Record<string, string> = {
  api: 'API',
  graphql: 'GraphQL',
  mcp: 'MCP',
  skill: 'Skill',
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Root-only flags. `--help` is omitted — every CLI user knows it exists
 *  and it's parsed regardless; documenting it is noise. `--version` stays
 *  because its presence communicates "this tool is versioned." */
export const ROOT_OPTION_ROWS: Array<[string, string]> = [
  ['-v, --version', 'output version information and exit'],
];

/** Interface-context flags (for api/graphql/mcp invocations).
 *  `--help` is documented here (unlike at root) because at interface scope
 *  it looks a lot like something you'd pass through to the request — being
 *  explicit removes ambiguity. */
export const INTERFACE_OPTION_ROWS: Array<[string, string]> = [
  ['-H, --header <key:value>', 'add a request header'],
  ['-A, --all', 'list all resources'],
  ['-F, --filter <text>', 'fuzzy-filter resources by name'],
  ['-X, --method <verb>', 'filter resources by HTTP method'],
  ['-h, --help', 'show help for this subcommand'],
  ['-v, --version', 'show extension spec versions'],
];

// ── shared table helper ───────────────────────────────────────
// Renders rows with column alignment. Cells may contain ANSI escapes;
// visible width is measured with those stripped.
function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

export interface HelpSection {
  title: string;
  /** Rows as string[][]. All columns except the last are treated as "left".
   *  Last column is the description (flexible, wraps). Empty arrays render no header. */
  rows: string[][];
}

/**
 * Render multiple sections with flexbox-like alignment:
 *   - Within each section, non-last columns align locally.
 *   - Across all sections, the boundary between left-blob and description
 *     is at the same column (global max).
 *   - The description column auto-wraps to respect maxLineWidth.
 */
export function renderSections(sections: HelpSection[], maxLineWidth = 80) {
  const INDENT = '  ';
  const GAP = '  ';

  // Flatten each section into [leftBlob, desc] pairs using per-section
  // internal widths for non-last cols.
  const flattened = sections.map((s) => {
    if (!s.rows.length) return { title: s.title, rows: [] as Array<[string, string]> };
    const cols = Math.max(...s.rows.map((r) => r.length));
    const widths = Array<number>(cols).fill(0);
    for (const row of s.rows) {
      for (let i = 0; i < cols; i++) {
        widths[i] = Math.max(widths[i], visibleLength(row[i] ?? ''));
      }
    }
    const rows: Array<[string, string]> = s.rows.map((row) => {
      const left = row
        .slice(0, cols - 1)
        .map((cell, i) => (cell ?? '') + ' '.repeat(widths[i] - visibleLength(cell ?? '')))
        .join(GAP)
        .replace(/\s+$/, '');
      const desc = row[cols - 1] ?? '';
      return [left, desc];
    });
    return { title: s.title, rows };
  });

  // Global left-blob width — only rows that have a description contribute
  // (rows without descriptions just render at their natural width and don't
  // distort alignment for the rest).
  const allRows = flattened.flatMap((s) => s.rows);
  if (!allRows.length) return;
  const rowsWithDesc = allRows.filter((r) => r[1].length > 0);
  const widthCandidates = (rowsWithDesc.length ? rowsWithDesc : allRows).map((r) => visibleLength(r[0]));
  const globalLeft = Math.max(...widthCandidates);
  const descBudget = Math.max(20, maxLineWidth - INDENT.length - globalLeft - GAP.length);

  for (const s of flattened) {
    if (!s.rows.length) continue;
    if (s.title) {
      console.log('');
      console.log(s.title);
    }
    for (const [left, desc] of s.rows) {
      const pad = ' '.repeat(Math.max(0, globalLeft - visibleLength(left)));
      const plain = desc.replace(/\x1b\[[0-9;]*m/g, '');
      if (!plain) {
        console.log(`${INDENT}${left}${pad}`.trimEnd());
        continue;
      }
      if (plain.length <= descBudget) {
        console.log(`${INDENT}${left}${pad}${GAP}${desc}`);
        continue;
      }
      const italic = /^\x1b\[3m/.test(desc);
      const wrap = (s: string) => (italic ? `${ITALIC}${s}${RESET}` : s);
      const lines = wrapText(plain, Math.max(10, descBudget));
      console.log(`${INDENT}${left}${pad}${GAP}${wrap(lines[0])}`);
      for (let i = 1; i < lines.length; i++) {
        console.log(`${INDENT}${' '.repeat(Math.max(0, globalLeft))}${GAP}${wrap(lines[i])}`);
      }
    }
  }
}

/** Back-compat single-table wrapper. */
export function printTable(rows: string[][], opts: { maxLineWidth?: number } = {}) {
  renderSections([{ title: '', rows }], opts.maxLineWidth);
}

function authMissingLabel(type?: string): string {
  switch (type) {
    case 'api-key': return 'missing api-key';
    case 'basic':   return 'missing basic auth credentials';
    case 'bearer':
    default:        return 'missing bearer token';
  }
}

function wrapText(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!line) { line = word; continue; }
    if (line.length + 1 + word.length <= width) {
      line += ' ' + word;
    } else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
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
  console.log(`A control surface of agentic I/O.

Usage: godmode <extension> [args]...
   or: godmode <extension> <interface> [args]...

Built-in extensions:
  ext                    Install and manage godmode extensions
  agent                  Coding-agent workflows

Options:
  -v, --version          output version information and exit

Run "godmode ext list" to see installed extensions.
Run "godmode <extension> --help" for extension-specific usage.

Report bugs to <https://github.com/tomsiwik/godmode/issues>.
Godmode home page: <https://godmode.so>.`);
}

export async function showVersion() {
  const { readFile } = await import('node:fs/promises');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'));
  const license = await readFile(resolve(root, 'LICENSE'), 'utf-8');
  const copyright = license.match(/^Copyright.*$/m)?.[0] ?? '';
  console.log(`godmode ${pkg.version}\n\n${pkg.license} License\n${copyright}`);
}

// ── showExtensionOverview (godmode <ext> --help) ────────────
// Lean overview: just title, Usage-per-interface, Interfaces list,
// Options, Global Options. No auth note, no Methods, no Resources —
// those belong to the interface-scoped page.

export function showExtensionOverview(multi: MultiManifest) {
  const title = titleCase(multi.name || multi.slug);
  console.log(title);

  const declared = Object.keys(multi.interfaces) as InterfaceKey[];
  const usageArgs = (iface: InterfaceKey) =>
    iface === 'mcp' ? ' <tool> [args]' :
    iface === 'graphql' ? ' <query> [flags]' :
    ' [method] <resource> [id] [flags]';

  console.log('');
  for (let i = 0; i < declared.length; i++) {
    const prefix = i === 0 ? 'Usage:' : '   or:';
    console.log(`${prefix} godmode ${multi.slug} ${declared[i]}${usageArgs(declared[i])}`);
  }

  const sections: HelpSection[] = [];
  sections.push({
    title: 'Interfaces:',
    rows: declared.map((iface) => {
      const data = multi.interfaces[iface];
      const url = data && 'url' in data && data.url ? data.url : '(local)';
      return [iface, url];
    }),
  });
  // Overview has no context flags (no interface selected). Only --version
  // applies here, and it prints this extension's spec versions.
  sections.push({
    title: 'Options:',
    rows: [['-v, --version', 'show extension spec versions']],
  });
  renderSections(sections);
}

/** Prints the extension's spec version(s) — one per declared interface. */
export function showExtensionVersion(multi: MultiManifest) {
  const declared = Object.keys(multi.interfaces) as InterfaceKey[];
  console.log(titleCase(multi.name || multi.slug));
  const rows: string[][] = declared.map((iface) => {
    const data = multi.interfaces[iface];
    const version = data?.specVersion || '(unversioned)';
    return [iface, version];
  });
  printTable(rows);
}

// ── showApiHelp ─────────────────────────────────────────────

export function showApiHelp(
  manifest: Manifest,
  apiName: string,
  path: string[],
  filter?: string,
  methodFilter?: string,
  all?: boolean,
  multi?: MultiManifest,
) {
  const root = buildTrie(manifest.routes);
  const nav = navigateTrie(root, path);
  if (!nav) { console.log('No matching resource.'); return; }
  const { node, fullPath } = nav;

  const actions = getNodeActions(node);
  const param = getParamName(node);
  const children = getChildren(node).filter((c) => !c.isParam);
  const childNames = [...new Set(children.map((c) => c.name))];
  const resourceName = fullPath.join(' ');

  const auth = manifest.config.auth;
  const envOk = auth?.env ? !!process.env[auth.env] : true;
  const ifaceType = manifest.config.type;

  // Header
  if (!path.length) {
    const ifaceLabel = INTERFACE_LABEL[ifaceType] || ifaceType;
    const title = `${titleCase(manifest.config.name || apiName)} ${ifaceLabel}`;

    // Title only — version moved to `--version`; no inline noise.
    console.log(title);

    // Auth status note — surface only when credentials are missing.
    if (auth?.env && !envOk) {
      const arrow = USE_COLOR ? `${RED}-->${RESET}` : '-->';
      const label = authMissingLabel(auth.type);
      const body = USE_COLOR ? `${RED}${label}${RESET}` : label;
      console.log(`${arrow} ${auth.env}: ${body}\n`);
    }

    // Primary invocation first, then one `or:` line per additional declared interface.
    const declared: InterfaceKey[] = multi
      ? (Object.keys(multi.interfaces) as InterfaceKey[])
      : [ifaceType as InterfaceKey];
    const ordered = [ifaceType as InterfaceKey, ...declared.filter((k) => k !== ifaceType)];

    const usageArgs = (iface: InterfaceKey) =>
      iface === 'mcp' ? ' <tool> [args]' :
      iface === 'graphql' ? ' <query> [flags]' :
      ' [method] <resource> [id] [flags]';

    for (let i = 0; i < ordered.length; i++) {
      const iface = ordered[i];
      const prefix = i === 0 ? 'Usage:' : '   or:';
      console.log(`${prefix} godmode ${apiName} ${iface}${usageArgs(iface)}`);
    }

    // Collect sections for globally-aligned render at tail.
    // Interfaces section is only in the extension overview — inside an
    // interface page the user already knows which one they're looking at.
    const sections: HelpSection[] = [];

    if (ifaceType === 'api') {
      const methodsPresent = new Set(manifest.routes.map((r) => r.method.toLowerCase()));
      const METHOD_DESC: Record<string, string> = {
        get: 'retrieve a resource',
        post: 'create a resource or send a command',
        put: 'replace a resource',
        patch: 'modify a resource',
        delete: 'remove a resource',
        head: 'retrieve headers only',
      };
      const order = ['get', 'post', 'put', 'patch', 'delete', 'head'] as const;
      const methodsHere = order.filter((m) => methodsPresent.has(m));
      if (methodsHere.length) {
        sections.push({
          title: 'Methods:',
          rows: methodsHere.map((m) => [METHOD_LABEL[m] || m.toUpperCase(), METHOD_DESC[m]]),
        });
      }
    }

    // Resources section (sub-resources at this level)
    const resourceSection = buildResourceSection(
      children,
      childNames,
      manifest,
      filter,
      methodFilter,
      all,
    );
    if (resourceSection) sections.push(resourceSection.section);

    // Options + Global Options — always
    sections.push({ title: 'Options:', rows: INTERFACE_OPTION_ROWS as string[][] });

    renderSections(sections);
    return;
  } else {
    // Drilled-in view (path.length > 0)
    const paramHint = getParamName(node);
    const idRef = paramHint ? ` [${paramHint}]` : '';

    if (auth?.env && !envOk) {
      const arrow = USE_COLOR ? `${RED}-->${RESET}` : '-->';
      const label = authMissingLabel(auth.type);
      const body = USE_COLOR ? `${RED}${label}${RESET}` : label;
      console.log(`${arrow} ${auth.env}: ${body}\n`);
    }
    console.log(`Usage: godmode ${apiName} ${ifaceType} ${resourceName}${idRef} [flags]`);

    if (USE_COLOR) {
      for (const p of nav.params) {
        const status = p.provided ? `${GREEN}(${p.value})${RESET}` : `${RED}(missing parameter)${RESET}`;
        console.log(`<${p.name}> ${status}`);
      }
      if (nav.params.length) console.log('');
    }

    const sections: HelpSection[] = [];

    // MCP tool params (if navigating into an MCP tool)
    const mcpTools = (manifest.config as { _mcpTools?: Array<{ name: string; description?: string; inputSchema?: { properties?: Record<string, { type: string; description?: string }>; required?: string[] } }> })._mcpTools;
    const mcpTool = mcpTools?.find((t) => t.name === path[path.length - 1]);
    if (mcpTool?.inputSchema?.properties) {
      const props = mcpTool.inputSchema.properties;
      const required = new Set<string>(mcpTool.inputSchema.required || []);
      const rows: string[][] = [];
      for (const [name, schema] of Object.entries(props)) {
        const req = required.has(name) ? `${RED}[REQUIRED]${RESET}` : '';
        const desc = schema.description ? `${ITALIC}${schema.description}${RESET}` : '';
        rows.push([name, req, desc]);
      }
      sections.push({ title: 'Parameters:', rows });
    } else {
      // REST method combinations for this resource
      const order = ['get', 'post', 'put', 'patch', 'delete'] as const;
      const pc = node.children.find((c) => c.isParam);
      const rows: Array<{ method: string; summary: string; needsId: boolean }> = [];
      for (const ep of node.methods) rows.push({ method: ep.method, summary: ep.summary, needsId: false });
      if (pc) for (const ep of pc.methods) rows.push({ method: ep.method, summary: ep.summary, needsId: true });

      if (rows.length) {
        const tableRows: string[][] = [];
        for (const m of order) {
          for (const r of rows.filter((r) => r.method === m)) {
            const label = METHOD_LABEL[m] || m.toUpperCase();
            const idArg = r.needsId ? `<${pc!.name}>` : '';
            const desc = r.summary ? `${ITALIC}${r.summary}${RESET}` : '';
            tableRows.push([label, idArg, desc]);
          }
        }
        sections.push({ title: 'Methods:', rows: tableRows });
      }
    }

    const resourceSection = buildResourceSection(children, childNames, manifest, filter, methodFilter, all);
    if (resourceSection) sections.push(resourceSection.section);

    sections.push({ title: 'Options:', rows: INTERFACE_OPTION_ROWS as string[][] });

    renderSections(sections);
  }
}

// ── section builders ──────────────────────────────────────────

function buildResourceSection(
  children: TrieNode[],
  childNames: string[],
  manifest: Manifest,
  filter?: string,
  methodFilter?: string,
  all?: boolean,
): { section: HelpSection; hint?: string } | null {
  if (!childNames.length) return null;

  const ALL_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
  const mf = methodFilter ? fuzzysort.go(methodFilter, ALL_METHODS)[0]?.target : undefined;
  if (methodFilter && !mf) return null;

  const candidates = mf
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

  const filtered = filter ? fuzzysort.go(filter, candidates).map((r) => r.target) : candidates;
  const title = filter || mf
    ? `Resources${filter ? ` matching "${filter}"` : ''}${mf ? ` with ${mf.toUpperCase()}` : ''}:`
    : 'Resources:';

  if (!filtered.length) return { section: { title, rows: [['  No matches.', '']] } };

  const limit = (filter || mf || all) ? filtered.length : 5;
  const shown = filtered.slice(0, limit);
  const more = filtered.length - shown.length;

  // Two-column [name, meta+desc] so Resources participates in the global
  // description-column alignment with Options/Methods/etc.
  const rows: string[][] = [];
  for (const n of shown) {
    const child = children.find((c) => c.name === n);
    const labels = child ? methodLabels(child) : '';
    const subCount = child ? getChildren(child).filter((c) => !c.isParam).length : 0;
    const sub = subCount ? `(${subCount} sub)` : '';
    const rawDesc = manifest.resourceDescriptions[n] || '';
    const desc = rawDesc ? `${ITALIC}${rawDesc}${RESET}` : '';
    const parts = [labels, sub, desc].filter(Boolean);
    rows.push([n, parts.join('  ')]);
  }

  // Overflow indicator inline with the table, not a trailing footer.
  if (more) {
    const verb = mf ? ` ${mf.toUpperCase()}` : '';
    const hintText = `${more} more${verb} resources. Use options to display more`;
    const dots = USE_COLOR ? `${DIM}...${RESET}` : '...';
    const body = USE_COLOR ? `${DIM}${hintText}${RESET}` : hintText;
    rows.push([dots, body]);
  }

  return { section: { title, rows } };
}
