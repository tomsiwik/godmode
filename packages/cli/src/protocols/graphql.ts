import type { ApiConfig, Manifest, Route } from '../spec.js';

// ── introspection ───────────────────────────────────────────

const INTROSPECTION_QUERY = `{
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      name kind description
      fields { name description args { name type { name kind ofType { name kind } } } }
    }
  }
}`;

interface GqlField {
  name: string;
  description?: string;
  args?: Array<{ name: string; type: { name?: string; kind: string; ofType?: { name?: string; kind: string } } }>;
}

interface GqlType {
  name: string;
  kind: string;
  description?: string;
  fields?: GqlField[];
}

async function introspect(url: string, headers: Record<string, string>): Promise<GqlType[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query: INTROSPECTION_QUERY }),
  });
  if (!res.ok) throw new Error(`Introspection failed: ${res.status} ${res.statusText}`);
  const json = await res.json() as { data?: { __schema?: { types?: GqlType[] } } };
  return json.data?.__schema?.types?.filter((t: GqlType) => !t.name.startsWith('__')) || [];
}

// ── SDL parsing ─────────────────────────────────────────────

function parseSdl(text: string): GqlType[] {
  const types: GqlType[] = [];
  const typeRegex = /type\s+(\w+)\s*\{([^}]*)}/g;
  let match;
  while ((match = typeRegex.exec(text)) !== null) {
    const [, typeName, body] = match;
    const fields: GqlField[] = [];
    const fieldRegex = /(\w+)(?:\(([^)]*)\))?\s*:\s*\S+/g;
    let fm;
    while ((fm = fieldRegex.exec(body)) !== null) {
      const args: GqlField['args'] = [];
      if (fm[2]) {
        const argRegex = /(\w+)\s*:\s*(\w+)/g;
        let am;
        while ((am = argRegex.exec(fm[2])) !== null) {
          args.push({ name: am[1], type: { name: am[2], kind: 'SCALAR' } });
        }
      }
      fields.push({ name: fm[1], args: args.length ? args : undefined });
    }
    types.push({ name: typeName, kind: 'OBJECT', fields });
  }
  return types;
}

// ── parse ───────────────────────────────────────────────────

export async function parseGraphQL(name: string, config: ApiConfig): Promise<Manifest> {
  let types: GqlType[];

  if (config.spec) {
    process.stderr.write(`Fetching ${config.spec}...\n`);
    const res = await fetch(config.spec);
    if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status}`);
    types = parseSdl(await res.text());
  } else {
    if (!config.url) throw new Error('GraphQL config needs either "spec" or "url"');
    process.stderr.write(`Introspecting ${config.url}...\n`);

    const headers: Record<string, string> = { ...config.headers };
    const token = config.auth?.env ? process.env[config.auth.env] : undefined;
    if (token) {
      const authType = config.auth?.type || 'bearer';
      if (authType === 'bearer') headers['Authorization'] = `Bearer ${token}`;
      else if (authType === 'api-key') headers[config.auth?.header || 'X-API-Key'] = token;
    }

    types = await introspect(config.url, headers);
  }

  const routes: Route[] = [];
  for (const type of types) {
    if (!type.fields) continue;
    const isQuery = type.name === 'Query' || type.name === 'RootQuery';
    const isMutation = type.name === 'Mutation' || type.name === 'RootMutation';
    if (!isQuery && !isMutation) continue;

    const method = isMutation ? 'post' : 'get';
    for (const field of type.fields) {
      routes.push({
        path: field.name,
        method,
        summary: field.description || '',
        version: '',
        segments: [{ value: field.name, isParam: false }],
      });
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path));
  process.stderr.write(`Parsed ${routes.length} fields (${types.length} types)\n`);

  return { name, description: config.description || '', specVersion: '', config, versions: [], resourceDescriptions: {}, routes };
}

// ── validation ──────────────────────────────────────────────

export function validateGraphQLFlags(
  method: string,
  query: Record<string, string>,
  body: Record<string, string>,
  apiName: string,
): string | null {
  if (['put', 'patch', 'delete', 'head'].includes(method)) {
    return `GraphQL only supports POST. ${method.toUpperCase()} is not valid.`;
  }
  if (method === 'post') {
    process.stderr.write(`Note: POST is implicit for GraphQL, flag not needed.\n`);
  }
  if (Object.keys(query).length || Object.keys(body).length) {
    return `GraphQL uses document syntax, not key=value params.\n  godmode ${apiName} '{ field { subfield } }'`;
  }
  return null;
}
