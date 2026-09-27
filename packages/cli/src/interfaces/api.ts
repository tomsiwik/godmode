import { parseOpenApi } from '@godmode-cli/interface-api';
import type { ApiInterfaceSource, InterfaceData, ManifestSource } from '../spec.js';
import { Interface } from './base.js';
import { compileWithParser } from './compile.js';
import { executeRoute } from './route.js';

export class ApiInterface extends Interface {
  static readonly key = 'api';
  static readonly usage = ' <method> <resource> [id] [flags]';

  static compile(name: string, source: ManifestSource): Promise<InterfaceData> {
    return compileWithParser(this.key, name, source, parseOpenApi, (flat, interfaceSource) => {
      const api = interfaceSource as ApiInterfaceSource;
      return { spec: api.spec, url: flat.config.url, prefix: api.prefix };
    });
  }

  validate(): string | null {
    if (!this.ctx.parsed.explicitMethod) {
      return `Missing HTTP method. Try: godmode ${this.ctx.extensionName} api GET ${this.ctx.parsed.segments.join(' ')}\n`
        + `Valid methods: GET, POST, PUT, PATCH, DELETE, HEAD.`;
    }
    return null;
  }

  execute(): Promise<void> { return executeRoute(this.ctx); }
}
