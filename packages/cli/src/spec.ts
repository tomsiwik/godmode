import { parseOpenApi } from './protocols/api.js';
import { parseGraphQL } from './protocols/graphql.js';
import { parseMcp } from './protocols/mcp.js';

// ── types ───────────────────────────────────────────────────

export interface AuthConfig {
  env?: string;
  type?: 'bearer' | 'api-key' | 'basic';
  header?: string;
}

export interface VersionConfig {
  prefix: string;
  name?: string;
}

export interface ApiConfig {
  slug?: string;
  name?: string;
  description?: string;
  type: 'api' | 'graphql' | 'mcp' | 'channels';
  spec?: string;
  url?: string;
  prefix?: string;
  versions?: VersionConfig[];
  auth?: AuthConfig;
  headers?: Record<string, string>;
}

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

export interface Manifest {
  name: string;
  description: string;
  specVersion: string;
  config: ApiConfig;
  versions: VersionConfig[];
  resourceDescriptions: Record<string, string>;
  routes: Route[];
}

// ── strategy dispatcher ─────────────────────────────────────

const parsers: Record<string, (name: string, config: ApiConfig) => Promise<Manifest>> = {
  api: parseOpenApi,
  graphql: parseGraphQL,
  mcp: parseMcp,
};

// Lazy-register channels parser to avoid loading the package at startup
async function loadChannelsParser() {
  const { parseChannels } = await import('@godmode-cli/claude-code-channels');
  parsers.channels = parseChannels;
}

export async function parseSpec(name: string, config: ApiConfig): Promise<Manifest> {
  if (config.type === 'channels' && !parsers.channels) await loadChannelsParser();
  const parser = parsers[config.type];
  if (!parser) throw new Error(`Unknown type "${config.type}" — supported: ${Object.keys(parsers).join(', ')}`);
  return parser(name, config);
}
