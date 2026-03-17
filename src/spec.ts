import { parse as parseYaml } from 'yaml';

export interface AuthConfig {
  env?: string;
  type?: 'bearer' | 'api-key' | 'basic';
  header?: string;
}

export interface VersionConfig {
  prefix: string;   // e.g. "/v1"
  name?: string;     // e.g. "v1" — defaults to prefix without slashes
}

export interface ApiConfig {
  name?: string;
  description?: string;
  type: 'api';
  spec: string;
  url: string;
  prefix?: string;                  // Simple single-prefix (shorthand)
  versions?: VersionConfig[];       // Multi-version prefixes
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
  segments: Segment[];
}

export interface Manifest {
  name: string;
  description: string;
  specVersion: string;
  config: ApiConfig;
  versions: VersionConfig[];
  routes: Route[];
}

export async function parseSpec(name: string, config: ApiConfig): Promise<Manifest> {
  process.stderr.write(`Fetching ${config.spec}...\n`);
  const res = await fetch(config.spec);
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
  const text = await res.text();

  const isJson = text.trimStart().startsWith('{');
  const spec = isJson ? JSON.parse(text) : parseYaml(text);

  if (!spec.paths) throw new Error('No paths found — is this a valid OpenAPI document?');

  // Detect base URL from spec if not in config
  if (!config.url) {
    if (spec.servers?.[0]?.url) {
      config.url = spec.servers[0].url;
    } else if (spec.host) {
      const scheme = spec.schemes?.[0] || 'https';
      config.url = `${scheme}://${spec.host}${spec.basePath || ''}`;
    }
  }

  // Resolve version prefixes
  const versions = resolveVersions(config, Object.keys(spec.paths));

  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head'] as const;
  const routes: Route[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of httpMethods) {
      const op = (pathItem as Record<string, any>)[method];
      if (!op) continue;

      // Find which version this path belongs to
      const ver = versions.find((v) => path.startsWith(v.prefix));
      const version = ver?.name || '';
      const stripped = ver ? path.slice(ver.prefix.length).replace(/^\//, '') : path.slice(1);

      const rawSegments = stripped.split('/').filter(Boolean);
      const segments: Segment[] = rawSegments.map((s) => {
        const isParam = s.startsWith('{') && s.endsWith('}');
        return { value: isParam ? s.slice(1, -1) : s, isParam };
      });

      routes.push({ path, method, summary: op.summary || '', version, segments });
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const description = config.description || spec.info?.description || '';
  const specVersion = spec.info?.version || '';

  const versionNames = versions.map((v) => v.name).join(', ');
  process.stderr.write(`Parsed ${routes.length} routes (versions: ${versionNames || 'none'})\n`);
  return { name, description, specVersion, config, versions, routes };
}

function resolveVersions(config: ApiConfig, paths: string[]): VersionConfig[] {
  // Explicit versions in config
  if (config.versions?.length) {
    return config.versions.map((v) => ({
      prefix: v.prefix.endsWith('/') ? v.prefix.slice(0, -1) : v.prefix,
      name: v.name || v.prefix.replace(/^\//, ''),
    }));
  }

  // Single prefix shorthand
  if (config.prefix) {
    const prefix = config.prefix.endsWith('/') ? config.prefix.slice(0, -1) : config.prefix;
    return [{ prefix, name: prefix.replace(/^\//, '') }];
  }

  // Auto-detect: find /v1, /v2, /api/v1, etc.
  const versionPattern = /^(\/(?:api\/)?v\d+)/;
  const detected = new Map<string, number>();
  for (const p of paths) {
    const match = p.match(versionPattern);
    if (match) detected.set(match[1], (detected.get(match[1]) || 0) + 1);
  }

  if (detected.size) {
    return [...detected.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([prefix]) => ({ prefix, name: prefix.replace(/^\//, '') }));
  }

  // No version prefix detected — use root
  return [{ prefix: '', name: '' }];
}
