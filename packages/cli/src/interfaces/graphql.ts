import { parseGraphQL, validateGraphQLFlags } from '@godmode-cli/interface-graphql';
import type { GraphqlInterfaceSource, InterfaceData, ManifestSource } from '../spec.js';
import { Interface } from './base.js';
import { compileWithParser } from './compile.js';
import { executeRoute } from './route.js';

export class GraphqlInterface extends Interface {
  static readonly key = 'graphql';
  static readonly usage = ' <query> [flags]';

  static compile(name: string, source: ManifestSource): Promise<InterfaceData> {
    return compileWithParser(this.key, name, source, parseGraphQL, (flat, interfaceSource) => {
      const graphql = interfaceSource as GraphqlInterfaceSource;
      return { spec: graphql.spec, url: flat.config.url };
    });
  }

  validate(): string | null {
    const { parsed, extensionName } = this.ctx;
    return validateGraphQLFlags(parsed.method, parsed.query, parsed.body, extensionName);
  }

  execute(): Promise<void> { return executeRoute(this.ctx); }
}
