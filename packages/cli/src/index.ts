import { loadEnv } from './env.js';
import {
  removeApi,
  updateApi,
  listApis,
  loadManifest,
  loadMultiManifest,
  findInstalledManifestSync,
} from './config.js';
import type { InterfaceKey, MultiManifest } from './spec.js';
import { parseArgs } from './args.js';
import { showHelp, showApiHelp, showExtensionOverview, showExtensionVersion, showVersion } from './help.js';
import { runAgentCommand } from '@godmode-cli/command-agent';
import { getInterface } from './interfaces.js';

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
  return findInstalledManifestSync(name);
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
  install <name|folder>     Install an extension (project scope)
  uninstall <name>          Uninstall an extension
  update <name>             Re-fetch spec, rebuild routes
  list                      Show installed extensions (project + global)
  create                    Interactive manifest wizard

Options:
  -g, --global              Apply to ~/.godmode (default: <cwd>/.godmode)`);
}

/** Pull `-g` / `--global` out of the args list, return the remaining args
 *  plus the resolved scope. */
function extractScope(args: string[]): { rest: string[]; scope: 'project' | 'global' | undefined } {
  const rest: string[] = [];
  let global = false;
  for (const a of args) {
    if (a === '-g' || a === '--global') { global = true; continue; }
    rest.push(a);
  }
  return { rest, scope: global ? 'global' : undefined };
}

async function runExt(rest: string[]) {
  const cmd = rest[0];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    showExtHelp();
    return;
  }

  const { rest: cmdArgs, scope } = extractScope(rest.slice(1));

  if (cmd === 'install') {
    const target = cmdArgs[0];
    if (!target) { console.error('Usage: godmode ext install [-g] <name|folder>'); process.exit(1); }
    if (RESERVED_SLUGS.has(target)) {
      process.stderr.write(`'${target}' is a reserved extension slug and cannot be installed.\n`);
      process.stderr.write(`Reserved: ${[...RESERVED_SLUGS].join(', ')}.\n`);
      process.exit(1);
    }
    const { runAdd } = await import('./commands/add.js');
    await runAdd(cmdArgs, scope ?? 'project');
    return;
  }

  if (cmd === 'uninstall') {
    if (!cmdArgs[0]) { console.error('Usage: godmode ext uninstall [-g] <name>'); process.exit(1); }
    await removeApi(cmdArgs[0], scope);
    return;
  }

  if (cmd === 'update') {
    if (!cmdArgs[0]) { console.error('Usage: godmode ext update [-g] <name>'); process.exit(1); }
    await updateApi(cmdArgs[0], scope);
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

  const ifaceKey = iface as InterfaceKey;
  const parsed = parseArgs(rest);
  const multi = await loadMultiManifest(extensionName);
  const manifest = await loadManifest(extensionName, ifaceKey);

  const handler = getInterface({
    iface: ifaceKey, extensionName, manifest, multi, parsed, rawRest: rest,
  });

  if (parsed.help) {
    handler.showHelp();
    return;
  }

  if (!parsed.segments.length) {
    await handler.handleEmpty();
    return;
  }

  const err = handler.validate();
  if (err) {
    process.stderr.write(err + '\n');
    process.exit(1);
  }

  await handler.execute();
}

main().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
