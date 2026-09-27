import type {
  ApiConfig,
  InterfaceData,
  InterfaceSource,
  Manifest,
  ManifestSource,
  VersionConfig,
} from '../spec.js';

type Parser = (name: string, config: ApiConfig) => Promise<Manifest>;

export async function compileWithParser(
  key: string,
  name: string,
  source: ManifestSource,
  parser: Parser,
  project: (flat: Manifest, interfaceSource: InterfaceSource) => Record<string, unknown>,
): Promise<InterfaceData> {
  const interfaceSource = source.interfaces[key];
  if (!interfaceSource) throw new Error(`Interface '${key}' not declared on '${name}'`);
  const values = interfaceSource as Record<string, unknown>;
  const flat = await parser(name, {
    slug: source.slug || name,
    name: source.name,
    description: source.description,
    type: key,
    auth: source.auth,
    headers: source.headers,
    ...(typeof values.spec === 'string' ? { spec: values.spec } : {}),
    ...(typeof values.url === 'string' ? { url: values.url } : {}),
    ...(typeof values.prefix === 'string' ? { prefix: values.prefix } : {}),
    ...(Array.isArray(values.versions) ? { versions: values.versions as VersionConfig[] } : {}),
  });

  return {
    type: key,
    specVersion: flat.specVersion,
    versions: flat.versions,
    resourceDescriptions: flat.resourceDescriptions,
    routes: flat.routes,
    ...project(flat, interfaceSource),
  };
}
