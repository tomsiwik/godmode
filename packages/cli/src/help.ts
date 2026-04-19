import fuzzysort from 'fuzzysort';
import {
  authMissingLabel,
  DIM,
  GREEN,
  HelpPage,
  HelpSection,
  ITALIC,
  printTable,
  renderSections,
  RED,
  RESET,
  USE_COLOR,
  visibleLength,
  wrapText,
  type AuthNote,
  type Footer,
  type HelpPageData,
} from '@godmode-cli/cli';
import type { InterfaceKey, Manifest, MultiManifest, Route } from './spec.js';

// Re-exports so consumers that imported these from 'godmode/help' keep working.
export { HelpPage, renderSections, printTable, USE_COLOR, RESET, RED, DIM, ITALIC, GREEN, visibleLength, wrapText, authMissingLabel };
export type { HelpSection, AuthNote, Footer, HelpPageData };

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

const METHOD_LABEL: Record<string, string> = USE_COLOR
  ? {
      get:    '\x1b[1;38;5;34mGET\x1b[0m',
      post:   '\x1b[1;38;5;25mPOST\x1b[0m',
      put:    '\x1b[1;38;5;172mPUT\x1b[0m',
      patch:  '\x1b[1;38;5;30mPATCH\x1b[0m',
      delete: '\x1b[1;38;5;160mDELETE\x1b[0m',
    }
  : { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE' };

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

// ── concrete pages ──────────────────────────────────────────

export class RootHelp extends HelpPage {
  tagline() { return 'A control surface of agentic I/O.'; }
  usage() {
    return [
      'godmode <extension> [args]...',
      'godmode <extension> <interface> [args]...',
    ];
  }
  sections() {
    return [
      { title: 'Built-in extensions:', rows: [
        ['ext', 'Install and manage godmode extensions'],
        ['agent', 'Coding-agent workflows'],
      ] as string[][] },
      { title: 'Options:', rows: ROOT_OPTION_ROWS as string[][] },
    ];
  }
  footer(): Footer {
    return {
      extras: [
        'Run "godmode ext list" to see installed extensions.',
        'Run "godmode <extension> --help" for extension-specific usage.',
      ],
      reportBugs: 'https://github.com/tomsiwik/godmode/issues',
      homepage: 'https://godmode.so',
    };
  }
}

export class ExtHelp extends HelpPage {
  tagline() { return 'Install, inspect, and manage godmode extensions.'; }
  usage() { return ['godmode ext <command> [args]']; }
  sections() {
    return [
      { title: 'Commands:', rows: [
        ['install <name|folder>', 'Install an extension'],
        ['uninstall <name>', 'Uninstall an extension'],
        ['update <name>', 'Re-fetch spec, rebuild routes'],
        ['list', 'Show installed extensions'],
        ['create', 'Interactive manifest wizard'],
      ] as string[][] },
    ];
  }
}

export class ExtensionOverview extends HelpPage {
  constructor(protected multi: MultiManifest) { super(); }
  title() { return titleCase(this.multi.name || this.multi.slug); }
  usage() {
    const declared = Object.keys(this.multi.interfaces) as InterfaceKey[];
    const args = (iface: InterfaceKey) =>
      iface === 'mcp' ? ' <tool> [args]' :
      iface === 'graphql' ? ' <query> [flags]' :
      ' <method> <resource> [id] [flags]';
    return declared.map((iface) => `godmode ${this.multi.slug} ${iface}${args(iface)}`);
  }
  sections() {
    const declared = Object.keys(this.multi.interfaces) as InterfaceKey[];
    return [
      { title: 'Interfaces:', rows: declared.map((iface) => {
        const d = this.multi.interfaces[iface];
        const url = d && 'url' in d && d.url ? d.url : '(local)';
        return [iface, url];
      }) as string[][] },
      { title: 'Options:', rows: [['-v, --version', 'show extension spec versions']] as string[][] },
    ];
  }
}

export class ExtensionVersionPage extends HelpPage {
  constructor(protected multi: MultiManifest) { super(); }
  title() { return titleCase(this.multi.name || this.multi.slug); }
  sections() {
    const declared = Object.keys(this.multi.interfaces) as InterfaceKey[];
    return [
      { title: '', rows: declared.map((iface) => {
        const d = this.multi.interfaces[iface];
        return [iface, d?.specVersion || '(unversioned)'];
      }) as string[][] },
    ];
  }
}

export interface InterfaceHelpOpts {
  multi?: MultiManifest;
  filter?: string;
  methodFilter?: string;
  all?: boolean;
}

export class InterfaceHelp extends HelpPage {
  constructor(
    protected manifest: Manifest,
    protected apiName: string,
    rawPath: string[] = [],
    protected opts: InterfaceHelpOpts = {},
  ) {
    super();
    // Be forgiving in help mode: if the user typed `resource METHOD --help`,
    // strip the trailing verb so we can still navigate to the resource page.
    const HTTP_VERBS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);
    const cleaned = [...rawPath];
    while (cleaned.length && HTTP_VERBS.has(cleaned[cleaned.length - 1].toUpperCase())) {
      cleaned.pop();
    }
    this.path = cleaned;
  }

  protected path: string[];

  protected get ifaceType(): InterfaceKey { return this.manifest.config.type; }

  protected getNav() {
    const root = buildTrie(this.manifest.routes);
    return navigateTrie(root, this.path);
  }

  title() {
    if (this.path.length) return null;
    return `${titleCase(this.manifest.config.name || this.apiName)} ${INTERFACE_LABEL[this.ifaceType] || this.ifaceType}`;
  }

  authNote(): AuthNote | null {
    const auth = this.manifest.config.auth;
    if (!auth?.env) return null;
    return {
      env: auth.env,
      authType: (auth.type || 'bearer') as AuthNote['authType'],
      present: !!process.env[auth.env],
    };
  }

  usage() {
    if (!this.path.length) {
      const multi = this.opts.multi;
      const declared: InterfaceKey[] = multi
        ? (Object.keys(multi.interfaces) as InterfaceKey[])
        : [this.ifaceType];
      const ordered = [this.ifaceType, ...declared.filter((k) => k !== this.ifaceType)];
      const args = (iface: InterfaceKey) =>
        iface === 'mcp' ? ' <tool> [args]' :
        iface === 'graphql' ? ' <query> [flags]' :
        ' <method> <resource> [id] [flags]';
      return ordered.map((iface) => `godmode ${this.apiName} ${iface}${args(iface)}`);
    }
    const nav = this.getNav();
    if (!nav) return [];
    const paramHint = getParamName(nav.node);
    const idRef = paramHint ? ` [${paramHint}]` : '';
    // Method is required and goes right after the interface keyword.
    const methodSlot = this.ifaceType === 'api' ? '<method> ' : '';
    return [`godmode ${this.apiName} ${this.ifaceType} ${methodSlot}${nav.fullPath.join(' ')}${idRef} [flags]`];
  }

  sections() {
    const nav = this.getNav();
    if (!nav) return [];
    const sections: HelpSection[] = [];

    if (!this.path.length) {
      if (this.ifaceType === 'api') {
        const methodsPresent = new Set(this.manifest.routes.map((r) => r.method.toLowerCase()));
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
    } else {
      // Drilled-in: MCP tool params OR REST method combinations for this resource
      const mcpTools = (this.manifest.config as { _mcpTools?: Array<{ name: string; description?: string; inputSchema?: { properties?: Record<string, { type: string; description?: string }>; required?: string[] } }> })._mcpTools;
      const mcpTool = mcpTools?.find((t) => t.name === this.path[this.path.length - 1]);
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
        const order = ['get', 'post', 'put', 'patch', 'delete'] as const;
        const pc = nav.node.children.find((c) => c.isParam);
        const items: Array<{ method: string; summary: string; needsId: boolean }> = [];
        for (const ep of nav.node.methods) items.push({ method: ep.method, summary: ep.summary, needsId: false });
        if (pc) for (const ep of pc.methods) items.push({ method: ep.method, summary: ep.summary, needsId: true });
        if (items.length) {
          const rows: string[][] = [];
          for (const m of order) {
            for (const r of items.filter((r) => r.method === m)) {
              const label = METHOD_LABEL[m] || m.toUpperCase();
              const idArg = r.needsId ? `<${pc!.name}>` : '';
              const desc = r.summary ? `${ITALIC}${r.summary}${RESET}` : '';
              rows.push([label, idArg, desc]);
            }
          }
          sections.push({ title: 'Methods:', rows });
        }
      }
    }

    const children = getChildren(nav.node).filter((c) => !c.isParam);
    const childNames = [...new Set(children.map((c) => c.name))];
    const resourceSection = buildResourceSection(
      children, childNames, this.manifest,
      this.opts.filter, this.opts.methodFilter, this.opts.all,
    );
    if (resourceSection) sections.push(resourceSection.section);

    sections.push({ title: 'Options:', rows: INTERFACE_OPTION_ROWS as string[][] });
    return sections;
  }

  /** Drilled-in view also shows param status lines (ANSI-only). */
  render() {
    super.render();
    // No-op: param status was TTY-only and mostly decorative. Kept out of
    // the class contract to keep the structure pure.
  }
}

// ── wrappers (kept for back-compat with existing callers) ──

export function showHelp() { new RootHelp().render(); }
export function showExtHelp() { new ExtHelp().render(); }
export function showExtensionOverview(multi: MultiManifest) { new ExtensionOverview(multi).render(); }
export function showExtensionVersion(multi: MultiManifest) { new ExtensionVersionPage(multi).render(); }
export function showApiHelp(
  manifest: Manifest,
  apiName: string,
  path: string[],
  filter?: string,
  methodFilter?: string,
  all?: boolean,
  multi?: MultiManifest,
) {
  new InterfaceHelp(manifest, apiName, path, { multi, filter, methodFilter, all }).render();
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
