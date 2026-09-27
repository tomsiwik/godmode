import { executeMcpTool, parseMcp, validateMcpFlags } from '@godmode-cli/interface-mcp';
import { runMcp } from '@godmode-cli/interface-mcp/command';
import { EXIT_CODES } from '../exit-codes.js';
import {
  checkPermission,
  resourceFromTool,
  suggestedAllowRule,
} from '../permissions.js';
import type { InterfaceData, ManifestSource, McpInterfaceSource } from '../spec.js';
import { Interface } from './base.js';
import { compileWithParser } from './compile.js';

export class McpInterface extends Interface {
  static readonly key = 'mcp';
  static readonly usage = ' <tool> [args]';

  static compile(name: string, source: ManifestSource): Promise<InterfaceData> {
    return compileWithParser(this.key, name, source, parseMcp, (flat, interfaceSource) => ({
      url: (interfaceSource as McpInterfaceSource).url,
      _mcpTools: flat.config._mcpTools,
    }));
  }

  async handleEmpty(): Promise<void> {
    const { extensionName, rawRest, config } = this.ctx;
    await runMcp(
      {
        godmodeHome: config.godmodeHome,
        loadManifest: (name) => config.loadManifest(name, 'mcp'),
        checkPermission,
      },
      [extensionName, ...rawRest],
    );
  }

  validate(): string | null {
    const { parsed } = this.ctx;
    return validateMcpFlags(parsed.method, parsed.query);
  }

  async execute(): Promise<void> {
    const { manifest, parsed, extensionName } = this.ctx;
    const tool = parsed.segments[0];
    const resource = resourceFromTool(tool);
    const check = checkPermission({ extension: extensionName, resource, method: 'mcp' });
    if (!check.allowed) {
      process.stderr.write(`Blocked: ${check.reason}\n`);
      process.stderr.write(`Suggested allow rule:\n${suggestedAllowRule({ extension: extensionName, resource, method: 'mcp' })}\n`);
      process.exit(EXIT_CODES.permissionDenied);
    }

    const result = await executeMcpTool(manifest.config, tool, parsed.body, {
      debug: parsed.debug,
      dryRun: parsed.dryRun,
    });
    if (result) process.stdout.write(result + '\n');
  }
}
