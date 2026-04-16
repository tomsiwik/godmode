import { loadEnv } from './env.js';
import { removeApi, updateApi, listApis, loadManifest } from './config.js';
import { matchRoute, suggestRoutes } from '@godmode-cli/interface-api/match';
import { execute } from '@godmode-cli/interface-api/request';
import { validateGraphQLFlags } from '@godmode-cli/interface-graphql';
import { validateMcpFlags, executeMcpTool } from '@godmode-cli/interface-mcp';
import { parseArgs, readStdin } from './args.js';
import { showHelp, showApiHelp } from './help.js';
import { runAgentCommand } from '@godmode-cli/command-agent';
import type { Route } from './spec.js';

loadEnv();

// ── known interfaces & commands ──

const INTERFACES = new Set(['api', 'graphql', 'mcp', 'skill']);

async function main() {
  const args = process.argv.slice(2);

  if (!args.length || (args.length === 1 && (args[0] === '-h' || args[0] === '--help'))) {
    showHelp();
    return;
  }

  const domain = args[0];

  // ── extension management ──

  if (domain === 'extension') {
    await runExtension(args.slice(1));
    return;
  }

  // ── installable commands ──

  if (domain === 'agent') {
    const code = await runAgentCommand(args.slice(1));
    if (code !== 0) process.exit(code);
    return;
  }

  // ── interfaces ──

  if (INTERFACES.has(domain)) {
    const extensionName = args[1];
    if (!extensionName) {
      process.stderr.write(`Usage: godmode ${domain} <extension> [args]\n`);
      process.exit(1);
    }
    await runInterface(domain, extensionName, args.slice(2));
    return;
  }

  // ── unknown ──

  process.stderr.write(`Unknown command: ${domain}\n`);
  process.stderr.write(`\nInterfaces:  api, graphql, mcp, skill`);
  process.stderr.write(`\nCommands:    extension, agent\n`);
  process.exit(1);
}

// ── extension subcommand ──

async function runExtension(args: string[]) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(`Manage extensions.

Usage:
  godmode extension <command> [args]

Commands:
  add <name|folder>       Install an extension
  remove <name>           Uninstall an extension
  update <name>           Re-fetch spec, rebuild routes
  list                    Show installed extensions
  info <name>             Show extension details and interfaces
  create                  Interactive manifest wizard`);
    return;
  }

  if (sub === 'add') {
    const { runAdd } = await import('./commands/add.js');
    await runAdd(args.slice(1));
    return;
  }

  if (sub === 'remove') {
    if (!args[1]) { console.error('Usage: godmode extension remove <name>'); process.exit(1); }
    await removeApi(args[1]);
    return;
  }

  if (sub === 'update') {
    if (!args[1]) { console.error('Usage: godmode extension update <name>'); process.exit(1); }
    await updateApi(args[1]);
    return;
  }

  if (sub === 'list') {
    await listApis();
    return;
  }

  if (sub === 'info') {
    if (!args[1]) { console.error('Usage: godmode extension info <name>'); process.exit(1); }
    const manifest = await loadManifest(args[1]);
    showApiHelp(manifest, args[1], [], undefined, undefined, false);
    return;
  }

  if (sub === 'create') {
    const { configWizard } = await import('./prompt.js');
    await configWizard();
    return;
  }

  process.stderr.write(`Unknown extension command: ${sub}\n`);
  process.exit(1);
}

// ── interface dispatch ──

async function runInterface(iface: string, extensionName: string, rest: string[]) {
  const parsed = parseArgs(rest);
  const manifest = await loadManifest(extensionName);

  if (parsed.help || !parsed.segments.length) {
    showApiHelp(manifest, extensionName, parsed.segments, parsed.filter, parsed.methodFilter, parsed.all);
    return;
  }

  // ── mcp ──

  if (iface === 'mcp') {
    const { runMcp } = await import('@godmode-cli/interface-mcp/command');
    await runMcp([extensionName, ...rest]);
    return;
  }

  // ── graphql ──

  if (iface === 'graphql') {
    const err = validateGraphQLFlags(parsed.method, parsed.query, parsed.body, extensionName);
    if (err) { process.stderr.write(err + '\n'); process.exit(1); }
  }

  // ── skill ──

  if (iface === 'skill') {
    // TODO: load skill from extension
    process.stderr.write(`Skill interface not yet implemented.\n`);
    process.exit(1);
  }

  // ── api (REST) ──

  if (manifest.config.type === 'mcp') {
    const err = validateMcpFlags(parsed.method, parsed.query);
    if (err) { process.stderr.write(err + '\n'); process.exit(1); }
    const result = await executeMcpTool(manifest.config, parsed.segments[0], parsed.body, {
      verbose: parsed.verbose,
      dryRun: parsed.dryRun,
    });
    if (result) process.stdout.write(result + '\n');
    return;
  }

  const query = parsed.query;
  const hasBody = Object.keys(parsed.body).length > 0;
  let body: string | undefined = hasBody ? JSON.stringify(parsed.body) : undefined;

  if (!body && ['post', 'put', 'patch'].includes(parsed.method)) body = await readStdin();

  if (parsed.segments[0]?.startsWith('/')) {
    const rawPath = parsed.segments[0];
    const syntheticRoute: Route = { path: rawPath, method: parsed.method, summary: '', version: '', segments: [] };
    await execute(manifest, { route: syntheticRoute, params: {} }, {
      headers: parsed.headers, query, body, token: parsed.token,
      verbose: parsed.verbose, dryRun: parsed.dryRun,
    });
    return;
  }

  const match = matchRoute(manifest, parsed.segments, parsed.method);

  if (!match) {
    process.stderr.write(`No ${parsed.method.toUpperCase()} route matching: ${parsed.segments.join(' ')}\n`);

    for (const m of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      if (m === parsed.method) continue;
      const alt = matchRoute(manifest, parsed.segments, m);
      if (alt) {
        const flag = m === 'delete' ? '-d' : `--${m}`;
        process.stderr.write(`  try: godmode api ${extensionName} ${parsed.segments.join(' ')} ${flag}\n`);
      }
    }

    const similar = suggestRoutes(manifest, parsed.segments).slice(0, 5);
    if (similar.length) {
      process.stderr.write('\nSimilar:\n');
      const seen = new Set<string>();
      for (const r of similar) {
        const p = r.segments.map((s) => (s.isParam ? `{${s.value}}` : s.value)).join(' ');
        if (seen.has(p)) continue;
        seen.add(p);
        process.stderr.write(`  ${p}\n`);
      }
    }

    process.exit(1);
  }

  await execute(manifest, match, {
    headers: parsed.headers, query, body, token: parsed.token,
    verbose: parsed.verbose, dryRun: parsed.dryRun,
  });
}

main().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
