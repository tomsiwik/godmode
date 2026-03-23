import { parse as parseYaml } from 'yaml';
import type { ApiConfig, Manifest, Route, Segment, VersionConfig } from '../spec.js';

export async function parseOpenApi(name: string, config: ApiConfig): Promise<Manifest> {
  process.stderr.write(`Fetching ${config.spec}...\n`);
  const res = await fetch(config.spec!);
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
  const text = await res.text();

  const isJson = text.trimStart().startsWith('{');
  const spec = isJson ? JSON.parse(text) : parseYaml(text);

  if (!spec.paths) throw new Error('No paths found — is this a valid OpenAPI document?');

  if (!config.url) {
    if (spec.servers?.[0]?.url) {
      config.url = spec.servers[0].url;
    } else if (spec.host) {
      const scheme = spec.schemes?.[0] || 'https';
      config.url = `${scheme}://${spec.host}${spec.basePath || ''}`;
    }
  }

  const versions = resolveVersions(config, Object.keys(spec.paths));
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head'] as const;
  const routes: Route[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of httpMethods) {
      const op = (pathItem as Record<string, any>)[method];
      if (!op) continue;

      const ver = versions.find((v) => path.startsWith(v.prefix));
      const version = ver?.name || '';
      const stripped = ver ? path.slice(ver.prefix.length).replace(/^\//, '') : path.slice(1);

      const rawSegments = stripped.split('/').filter(Boolean);
      const segments: Segment[] = rawSegments.map((s) => {
        const isParam = s.startsWith('{') && s.endsWith('}');
        return { value: isParam ? s.slice(1, -1) : s, isParam };
      });

      const tag = op.tags?.[0] || '';
      routes.push({ path, method, summary: op.summary || '', version, tag, segments });
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  // Resource descriptions from spec-level tag descriptions (if available)
  const resourceDescriptions: Record<string, string> = {};
  if (spec.tags) {
    const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').trim();
    for (const t of spec.tags) {
      if (t.name && t.description) {
        const first = stripHtml(t.description).split(/\.\s/)[0];
        resourceDescriptions[t.name] = first.endsWith('.') ? first : first + '.';
      }
    }
  }

  const description = config.description || spec.info?.description || '';
  const specVersion = spec.info?.version || '';
  const versionNames = versions.map((v) => v.name).join(', ');
  process.stderr.write(`Parsed ${routes.length} routes (versions: ${versionNames || 'none'})\n`);

  return { name, description, specVersion, config, versions, resourceDescriptions, routes };
}

export function validateApiFlags(method: string, _segments: string[]): string | null {
  // REST supports all methods — no restrictions
  return null;
}

function resolveVersions(config: ApiConfig, paths: string[]): VersionConfig[] {
  if (config.versions?.length) {
    return config.versions.map((v) => ({
      prefix: v.prefix.endsWith('/') ? v.prefix.slice(0, -1) : v.prefix,
      name: v.name || v.prefix.replace(/^\//, ''),
    }));
  }

  if (config.prefix) {
    const prefix = config.prefix.endsWith('/') ? config.prefix.slice(0, -1) : config.prefix;
    return [{ prefix, name: prefix.replace(/^\//, '') }];
  }

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

  return [{ prefix: '', name: '' }];
}
