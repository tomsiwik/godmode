import { parseOpenApi } from '@godmode-cli/interface-api';
import { parseGraphQL } from '@godmode-cli/interface-graphql';
import { parseMcp } from '@godmode-cli/interface-mcp';
import { getInterfaceProvider } from './interface-provider.js';

// ── auth & shared ─────────────────────────────────────────────

export interface AuthConfig {
  env?: string;
  type?: 'bearer' | 'api-key' | 'basic';
  header?: string;
}

export interface VersionConfig {
  prefix: string;
  name?: string;
}

// ── manifest, authored (user YAML) ────────────────────────────

/**
 * What the user writes in manifest.yaml.
 * Each `interfaces.<type>` entry carries only that interface's source config
 * (spec URL / base URL / versions). Parsing fills in routes/tools at registration.
 */
export interface ManifestSource {
  name: string;
  slug?: string;
  description?: string;
  interfaces: {
    api?: ApiInterfaceSource;
    graphql?: GraphqlInterfaceSource;
    mcp?: McpInterfaceSource;
    [name: string]: InterfaceSource | undefined;
  };
  auth?: AuthConfig;
  headers?: Record<string, string>;
}

export interface ApiInterfaceSource {
  spec: string;
  url?: string;
  prefix?: string;
  versions?: VersionConfig[];
}

export interface GraphqlInterfaceSource {
  spec?: string;
  url?: string;
}

export interface McpInterfaceSource {
  url: string;
}

export type InterfaceSource =
  | ApiInterfaceSource
  | GraphqlInterfaceSource
  | McpInterfaceSource
  | Record<string, unknown>;

/** Public interface namespace declared by an extension (for example `api`). */
export type InterfaceKey = string;

// ── route model (shared by all interfaces) ────────────────────

export interface Segment {
  value: string;
  isParam: boolean;
}

export interface Route {
  path: string;
  method: string;
  summary: string;
  version: string;
  tag?: string;
  segments: Segment[];
}

// ── compiled interface data (written to ~/.godmode/apis/<name>.json) ──

/**
 * Per-interface compiled data. Routes/tools produced by the parser,
 * merged with source config so downstream code has everything in one place.
 */
export interface ApiInterfaceData extends ApiInterfaceSource {
  type: 'api';
  specVersion: string;
  versions: VersionConfig[];
  resourceDescriptions: Record<string, string>;
  routes: Route[];
}

export interface GraphqlInterfaceData extends GraphqlInterfaceSource {
  type: 'graphql';
  specVersion: string;
  versions: VersionConfig[];
  resourceDescriptions: Record<string, string>;
  routes: Route[];
}

export interface McpInterfaceData extends McpInterfaceSource {
  type: 'mcp';
  specVersion: string;
  versions: VersionConfig[];
  resourceDescriptions: Record<string, string>;
  routes: Route[];
  /** Raw MCP tool definitions (for help rendering of input schemas). */
  _mcpTools?: Array<{ name: string; title?: string; description?: string; inputSchema?: unknown }>;
}

export interface GenericInterfaceData {
  type: string;
  specVersion: string;
  versions: VersionConfig[];
  resourceDescriptions: Record<string, string>;
  routes: Route[];
  [key: string]: unknown;
}

export type InterfaceData =
  | ApiInterfaceData
  | GraphqlInterfaceData
  | McpInterfaceData
  | GenericInterfaceData;

/**
 * On-disk extension record. One per extension, holds every declared interface's
 * compiled data. This is what loadManifest returns.
 */
export interface MultiManifest {
  name: string;
  slug: string;
  description: string;
  source?: 'local' | 'npm';
  packageName?: string;
  auth?: AuthConfig;
  headers?: Record<string, string>;
  interfaces: {
    api?: ApiInterfaceData;
    graphql?: GraphqlInterfaceData;
    mcp?: McpInterfaceData;
    [name: string]: InterfaceData | undefined;
  };
}

// ── flat Manifest (what downstream dispatchers see) ───────────

/**
 * Legacy flat shape: one interface's data merged with top-level metadata.
 * Produced by projecting MultiManifest for a specific interface.
 * Downstream code (interfaces/api/match.ts, request.ts, mcp-server.ts) uses this.
 */
export interface Manifest {
  name: string;
  description: string;
  specVersion: string;
  config: ApiConfig;
  versions: VersionConfig[];
  resourceDescriptions: Record<string, string>;
  routes: Route[];
}

/**
 * Legacy flat config shape. The old flat `type` + `spec` + `url` view.
 * Composed by projectManifest from (MultiManifest.auth ∪ interface-data).
 */
export interface ApiConfig {
  slug?: string;
  name?: string;
  description?: string;
  type: InterfaceKey;
  spec?: string;
  url?: string;
  prefix?: string;
  versions?: VersionConfig[];
  auth?: AuthConfig;
  headers?: Record<string, string>;
  /** MCP-only: tool definitions surfaced for help rendering. */
  _mcpTools?: McpInterfaceData['_mcpTools'];
}

export function projectManifest(multi: MultiManifest, iface: InterfaceKey): Manifest {
  const data = multi.interfaces[iface];
  if (!data) {
    throw new Error(
      `extension '${multi.slug}' does not declare an '${iface}' interface ` +
        `(declared: ${Object.keys(multi.interfaces).join(', ')})`,
    );
  }
  const sourceData = data as GenericInterfaceData;
  const config: ApiConfig = {
    slug: multi.slug,
    name: multi.name,
    description: multi.description,
    type: iface,
    auth: multi.auth,
    headers: multi.headers,
    ...(typeof sourceData.spec === 'string' ? { spec: sourceData.spec } : {}),
    ...(typeof sourceData.url === 'string' ? { url: sourceData.url } : {}),
    ...(typeof sourceData.prefix === 'string' ? { prefix: sourceData.prefix } : {}),
    versions: data.versions,
    ...(iface === 'mcp' && (data as McpInterfaceData)._mcpTools
      ? { _mcpTools: (data as McpInterfaceData)._mcpTools }
      : {}),
  };
  return {
    name: multi.name,
    description: multi.description,
    specVersion: data.specVersion,
    config,
    versions: data.versions,
    resourceDescriptions: data.resourceDescriptions,
    routes: data.routes,
  };
}

// ── strategy dispatcher ───────────────────────────────────────

type AnyParser = (name: string, config: ApiConfig) => Promise<Manifest>;
interface CompiledInterfaceBase {
  specVersion: string;
  versions: VersionConfig[];
  resourceDescriptions: Record<string, string>;
  routes: Route[];
}
async function compileLegacy(
  iface: string,
  name: string,
  source: ManifestSource,
  parser: AnyParser,
): Promise<{ flat: Manifest; ifaceSource: InterfaceSource; base: CompiledInterfaceBase }> {
  const ifaceSource = source.interfaces[iface];
  if (!ifaceSource) throw new Error(`Interface '${iface}' not declared on '${name}'`);
  const values = ifaceSource as Record<string, unknown>;

  const legacyConfig: ApiConfig = {
    slug: source.slug || name,
    name: source.name,
    description: source.description,
    type: iface,
    auth: source.auth,
    headers: source.headers,
    ...(typeof values.spec === 'string' ? { spec: values.spec } : {}),
    ...(typeof values.url === 'string' ? { url: values.url } : {}),
    ...(typeof values.prefix === 'string' ? { prefix: values.prefix } : {}),
    ...(Array.isArray(values.versions) ? { versions: values.versions as VersionConfig[] } : {}),
  };

  const flat = await parser(name, legacyConfig);
  return {
    flat,
    ifaceSource,
    base: {
      specVersion: flat.specVersion,
      versions: flat.versions,
      resourceDescriptions: flat.resourceDescriptions,
      routes: flat.routes,
    },
  };
}

export async function compileApiInterface(name: string, source: ManifestSource): Promise<InterfaceData> {
  const { flat, ifaceSource, base } = await compileLegacy('api', name, source, parseOpenApi);
  const api = ifaceSource as ApiInterfaceSource;
  return { ...base, type: 'api', spec: api.spec, url: flat.config.url, prefix: api.prefix };
}

export async function compileGraphqlInterface(name: string, source: ManifestSource): Promise<InterfaceData> {
  const { flat, ifaceSource, base } = await compileLegacy('graphql', name, source, parseGraphQL);
  const graphql = ifaceSource as GraphqlInterfaceSource;
  return { ...base, type: 'graphql', spec: graphql.spec, url: flat.config.url };
}

export async function compileMcpInterface(name: string, source: ManifestSource): Promise<InterfaceData> {
  const { flat, ifaceSource, base } = await compileLegacy('mcp', name, source, parseMcp);
  const mcp = ifaceSource as McpInterfaceSource;
  return { ...base, type: 'mcp', url: mcp.url, _mcpTools: flat.config._mcpTools };
}

/**
 * Run the parser for one interface and return its compiled data.
 * Each parser returns a legacy flat Manifest; we convert to InterfaceData.
 */
export async function compileInterface(
  iface: InterfaceKey,
  name: string,
  source: ManifestSource,
): Promise<InterfaceData> {
  const provider = getInterfaceProvider(iface);
  if (!provider) throw new Error(`Unknown interface '${iface}'`);
  return provider.compile(name, source);
}
