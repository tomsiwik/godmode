import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from './env.js';
import { removeApi, updateApi, listApis, loadManifest, loadMultiManifest, GODMODE_HOME } from './config.js';
import type { InterfaceKey, MultiManifest } from './spec.js';
import { matchRoute, suggestRoutes } from '@godmode-cli/interface-api/match';
import { execute } from '@godmode-cli/interface-api/request';
import { validateGraphQLFlags } from '@godmode-cli/interface-graphql';
import { validateMcpFlags, executeMcpTool } from '@godmode-cli/interface-mcp';
import { runMcp } from '@godmode-cli/interface-mcp/command';
import { parseArgs, readStdin } from './args.js';
import { showHelp, showApiHelp, showExtensionOverview, showExtensionVersion, showVersion } from './help.js';
import { runAgentCommand } from '@godmode-cli/command-agent';
import type { Route } from './spec.js';

loadEnv();

// ── grammar ──────────────────────────────────────────────────
//
//   godmode ext <command> [args]               — built-in: ext
//   godmode agent <command> [args]             — built-in: agent
//   godmode <extension> <interface> [args]     — user-installed: interface REQUIRED
//
// No inference. The extension's manifest declares which interfaces exist;
// the user picks one explicitly each time. Nested help drills at every
// level: `godmode stripe --help` → extension overview,
// `godmode stripe api --help` → interface help, etc.

const VALID_INTERFACES = new Set<InterfaceKey>(['api', 'graphql', 'mcp', 'skill']);
const RESERVED_SLUGS = new Set(['ext', 'agent']);

async function main() {
  const args = process.argv.slice(2);

  if (!args.length || (args.length === 1 && (args[0] === '-h' || args[0] === '--help'))) {
    showHelp();
    return;
  }

  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    await showVersion();
    return;
  }

  const extensionSlug = args[0];
  const rest = args.slice(1);

  // Built-in extensions — their `command` interface is implicit.
  if (extensionSlug === 'ext') {
    await runExt(rest);
    return;
  }
  if (extensionSlug === 'agent') {
    await runAgent(rest);
    return;
  }

  // User extensions — interface is required.
  const multi = installedExtension(extensionSlug);
  if (!multi) {
    process.stderr.write(`'${extensionSlug}' is not an installed extension.\n`);
    process.stderr.write(`Try 'godmode ext list' to see installed extensions.\n`);
    process.stderr.write(`Try 'godmode --help' for more information.\n`);
    process.exit(1);
  }

  const declared = declaredInterfaces(multi);
  const first = rest[0];

  // Bare `godmode <ext>` or `godmode <ext> --help` → extension overview
  if (!first || first === '--help' || first === '-h') {
    showExtensionOverview(multi);
    return;
  }

  // `godmode <ext> --version` → extension's spec version per interface
  if (first === '--version' || first === '-v') {
    showExtensionVersion(multi);
    return;
  }

  // Interface is mandatory. First token MUST be a declared interface.
  if (!VALID_INTERFACES.has(first as InterfaceKey)) {
    process.stderr.write(`Missing interface.\n`);
    process.stderr.write(`'${extensionSlug}' declares: ${declared.join(', ')}.\n`);
    process.stderr.write(`Try 'godmode ${extensionSlug} ${declared[0]} ${first}' or 'godmode ${extensionSlug} --help'.\n`);
    process.exit(1);
  }
  if (!declared.includes(first as InterfaceKey)) {
    process.stderr.write(`'${extensionSlug}' does not declare a '${first}' interface.\n`);
    process.stderr.write(`Declared: ${declared.join(', ')}.\n`);
    process.stderr.write(`Try 'godmode ${extensionSlug} --help' for more information.\n`);
    process.exit(1);
  }

  await runInterface(first as InterfaceKey, extensionSlug, rest.slice(1));
}

function installedExtension(name: string): MultiManifest | null {
  const extPath = resolve(GODMODE_HOME, 'apis', `${name}.json`);
  if (!existsSync(extPath)) return null;
  try {
    return JSON.parse(readFileSync(extPath, 'utf-8')) as MultiManifest;
  } catch {
    return null;
  }
}

function declaredInterfaces(m: MultiManifest): InterfaceKey[] {
  return Object.keys(m.interfaces) as InterfaceKey[];
}

// ── built-in: ext (package-manager commands) ──
//
// Declares one interface internally (`command`), but users never type it.
// `godmode ext install stripe` is the straight form.

function showExtHelp() {
  console.log(`Install, inspect, and manage godmode extensions.

Usage: godmode ext <command> [args]

Commands:
  install <name|folder>    Install an extension
  uninstall <name>         Uninstall an extension
  update <name>            Re-fetch spec, rebuild routes
  list                     Show installed extensions
  create                   Interactive manifest wizard`);
}

async function runExt(rest: string[]) {
  const cmd = rest[0];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    showExtHelp();
    return;
  }

  if (cmd === 'install') {
    const target = rest[1];
    if (!target) { console.error('Usage: godmode ext install <name|folder>'); process.exit(1); }
    if (RESERVED_SLUGS.has(target)) {
      process.stderr.write(`'${target}' is a reserved extension slug and cannot be installed.\n`);
      process.stderr.write(`Reserved: ${[...RESERVED_SLUGS].join(', ')}.\n`);
      process.exit(1);
    }
    const { runAdd } = await import('./commands/add.js');
    await runAdd(rest.slice(1));
    return;
  }

  if (cmd === 'uninstall') {
    if (!rest[1]) { console.error('Usage: godmode ext uninstall <name>'); process.exit(1); }
    await removeApi(rest[1]);
    return;
  }

  if (cmd === 'update') {
    if (!rest[1]) { console.error('Usage: godmode ext update <name>'); process.exit(1); }
    await updateApi(rest[1]);
    return;
  }

  if (cmd === 'list') {
    await listApis();
    return;
  }

  if (cmd === 'create') {
    const { configWizard } = await import('./prompt.js');
    await configWizard();
    return;
  }

  if (installedExtension(cmd)) {
    const multi = installedExtension(cmd)!;
    const ifaces = declaredInterfaces(multi);
    process.stderr.write(`'${cmd}' is an installed extension, not an ext command.\n\n`);
    process.stderr.write(`Did you mean:\n`);
    process.stderr.write(`  godmode ${cmd} --help\n`);
    for (const i of ifaces) {
      process.stderr.write(`  godmode ${cmd} ${i} --help\n`);
    }
    process.stderr.write(`\nTry 'godmode ext --help' for more information.\n`);
    process.exit(1);
  }

  process.stderr.write(`Unknown ext command '${cmd}'.\n`);
  process.stderr.write(`Try 'godmode ext --help' for more information.\n`);
  process.exit(1);
}

// ── built-in: agent ──

async function runAgent(rest: string[]) {
  const code = await runAgentCommand(rest);
  if (code !== 0) process.exit(code);
}

// ── interface dispatch ──

async function runInterface(iface: string, extensionName: string, rest: string[]) {
  if (iface === 'skill') {
    process.stderr.write(`Skill interface not yet implemented.\n`);
    process.exit(1);
  }

  // Intercept --version anywhere in the arg list — shows the extension's
  // spec version(s) regardless of nesting depth.
  if (rest.includes('--version') || rest.includes('-v')) {
    const multi = await loadMultiManifest(extensionName);
    showExtensionVersion(multi);
    return;
  }

  const parsed = parseArgs(rest);
  const ifaceKey = iface as InterfaceKey;
  const multi = await loadMultiManifest(extensionName);
  const manifest = await loadManifest(extensionName, ifaceKey);

  // In any help context (explicit --help OR no resource given), an explicit
  // method (positional GET/POST/…, or -g, -po, …) implicitly filters the
  // resources list to that verb.
  const implicitMethodFilter =
    parsed.methodFilter || (parsed.explicitMethod ? parsed.method : undefined);

  if (parsed.help) {
    showApiHelp(manifest, extensionName, parsed.segments, parsed.filter, implicitMethodFilter, parsed.all, multi);
    return;
  }

  // Bare `godmode mcp <ext>` with no tool → serve as MCP server over stdio.
  // With a tool (segments), fall through to executeMcpTool below.
  if (iface === 'mcp' && !parsed.segments.length) {
    await runMcp(
      { godmodeHome: GODMODE_HOME, loadManifest: (n) => loadManifest(n, 'mcp') },
      [extensionName, ...rest],
    );
    return;
  }

  if (!parsed.segments.length) {
    showApiHelp(manifest, extensionName, parsed.segments, parsed.filter, implicitMethodFilter, parsed.all, multi);
    return;
  }

  // ── graphql ──

  if (iface === 'graphql') {
    const err = validateGraphQLFlags(parsed.method, parsed.query, parsed.body, extensionName);
    if (err) { process.stderr.write(err + '\n'); process.exit(1); }
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
      headers: parsed.headers, query, body,
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
        process.stderr.write(`  try: godmode ${extensionName} api ${parsed.segments.join(' ')} ${flag}\n`);
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
