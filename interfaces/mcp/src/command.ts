import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { Manifest } from 'godmode/spec';

// Dependencies injected by the caller to avoid cross-package module resolution
// at runtime (see notes in README). The CLI package supplies these because
// it owns GODMODE_HOME and the loader.
export interface McpRuntime {
  godmodeHome: string;
  loadManifest: (name: string) => Promise<Manifest>;
}

export async function runMcp(rt: McpRuntime, args: string[]) {
  const name = args[0];
  if (!name || name === '--help' || name === '-h') {
    console.log(`Serve a registered API as an MCP server over stdio.

Usage:
  godmode mcp <name> [options]

Options:
  --filter <text>             Fuzzy-filter routes by resource name
  --method <method>           Filter by HTTP method (get, post, etc.)

For package-based extensions, spawns the extension's MCP server.
For spec-based extensions, serves routes as MCP tools.`);
    process.exit(name ? 0 : 1);
  }

  // Parse mcp-specific flags
  let filter: string | undefined;
  let method: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--filter' && args[i + 1]) filter = args[++i];
    else if (args[i] === '--method' && args[i + 1]) method = args[++i];
  }

  // Check for package-based extension with .mcp.json
  const pkgName = name.startsWith('@') ? name : `@godmode-cli/${name}`;
  const pkgDir = resolve(rt.godmodeHome, 'node_modules', pkgName);
  const mcpConfigPath = resolve(pkgDir, '.mcp.json');

  try {
    const mcpConfig = JSON.parse(await readFile(mcpConfigPath, 'utf-8'));
    const serverKey = Object.keys(mcpConfig.mcpServers)[0];
    const server = mcpConfig.mcpServers[serverKey];

    if (server.type === 'stdio' && server.command) {
      const child = spawn(server.command, server.args || [], {
        stdio: 'inherit',
        cwd: pkgDir,
        env: { ...process.env, ...server.env },
      });
      child.on('exit', (code) => process.exit(code ?? 0));
      return;
    }
  } catch {}

  // Fallback: generic MCP from manifest
  const manifest = await rt.loadManifest(name);
  const { serveMcp } = await import('./server.js');
  await serveMcp(manifest, { filter, method });
}
