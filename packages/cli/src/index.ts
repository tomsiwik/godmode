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
import { EXIT_CODES } from './exit-codes.js';
import { explainPermission, resourceFromRawPath, resourceFromSegments, suggestedAllowRule } from './permissions.js';
import { warnSettingsErrors } from './settings.js';
import { matchRoute } from '@godmode-cli/interface-api/match';

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
const RESERVED_SLUGS = new Set([
  'ext',
  'extension',
  'agent',
  'script',
  'workflow',
  'history',
  'sessions',
  'trace',
  'auth',
  'permissions',
]);

async function main() {
  const args = process.argv.slice(2);

  if (!args.length || (args.length === 1 && (args[0] === '-h' || args[0] === '--help'))) {
    warnSettingsErrors();
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
  if (extensionSlug === 'permissions') {
    await runPermissions(rest);
    return;
  }

  // User extensions — interface is required.
  const multi = installedExtension(extensionSlug);
  if (!multi) {
    process.stderr.write(`'${extensionSlug}' is not an installed extension.\n`);
    process.stderr.write(`Try 'godmode ext list' to see installed extensions.\n`);
    process.stderr.write(`Try 'godmode --help' for more information.\n`);
    process.exit(EXIT_CODES.notFound);
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
    process.exit(EXIT_CODES.usage);
  }
  if (!declared.includes(first as InterfaceKey)) {
    process.stderr.write(`'${extensionSlug}' does not declare a '${first}' interface.\n`);
    process.stderr.write(`Declared: ${declared.join(', ')}.\n`);
    process.stderr.write(`Try 'godmode ${extensionSlug} --help' for more information.\n`);
    process.exit(EXIT_CODES.usage);
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
    warnSettingsErrors();
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
    process.exit(EXIT_CODES.usage);
  }

  process.stderr.write(`Unknown ext command '${cmd}'.\n`);
  process.stderr.write(`Try 'godmode ext --help' for more information.\n`);
  process.exit(EXIT_CODES.usage);
}

// ── built-in: agent ──

async function runAgent(rest: string[]) {
  const code = await runAgentCommand(rest);
  if (code !== 0) process.exit(code);
}

// ── built-in: permissions ──

function showPermissionsHelp() {
  console.log(`Inspect godmode permission policy.

Usage:
  godmode permissions list
  godmode permissions explain <extension> <interface> <target> [method]

Exit codes:
  0   success / allowed
  2   usage or parse error
  3   extension or route not found
  4   permission denied
  10  upstream HTTP 4xx
  11  upstream HTTP 5xx
  12  upstream failure`);
}

async function runPermissions(rest: string[]) {
  const cmd = rest[0];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    warnSettingsErrors();
    showPermissionsHelp();
    return;
  }

  if (cmd === 'list') {
    const { loadSettingsDetailed } = await import('./settings.js');
    const loaded = loadSettingsDetailed();
    for (const error of loaded.errors) {
      process.stderr.write(`Warning: cannot parse ${error.path}: ${error.message}\n`);
    }
    const sources = loaded.sources.flatMap((source) => {
      const extensions = source.settings.extensions ?? {};
      return Object.entries(extensions).flatMap(([slug, settings]) => {
        const permissions = settings.permissions;
        if (!permissions?.allow?.length && !permissions?.deny?.length) return [];
        return [{ slug, permissions, origin: `${source.scope}:${source.path}` }];
      });
    });
    if (!sources.length) {
      console.log('No permissions configured.');
      return;
    }
    for (const { slug, permissions, origin } of sources) {
      console.log(`${slug}:`);
      for (const effect of ['allow', 'deny'] as const) {
        for (const rule of permissions[effect] ?? []) {
          const resources = rule.resources?.join(', ') || '*';
          const methods = rule.methods?.join(', ') || '*';
          console.log(`  ${effect} resources=[${resources}] methods=[${methods}] origin=${origin}`);
        }
      }
    }
    return;
  }

  if (cmd === 'explain') {
    const [extension, iface, target, maybeMethod] = rest.slice(1);
    if (!extension || !iface || !target) {
      process.stderr.write('Usage: godmode permissions explain <extension> <interface> <target> [method]\n');
      process.exit(EXIT_CODES.usage);
    }
    const method = iface === 'mcp' ? 'mcp' : (maybeMethod || 'GET');
    const resource = await explainResource(extension, iface, target, method);
    const decision = explainPermission({ extension, resource, method });
    console.log(`${decision.allowed ? 'allow' : 'deny'} ${extension} ${iface} ${target} ${method.toUpperCase()}`);
    if (decision.reason) console.log(decision.reason);
    if (decision.rule) {
      console.log(`winning rule: resources=[${decision.rule.resources?.join(', ') || '*'}] methods=[${decision.rule.methods?.join(', ') || '*'}] origin=${decision.origin || 'settings.yaml'}`);
    }
    if (!decision.allowed) {
      console.log(`suggested allow rule:\n${suggestedAllowRule({ extension, resource, method })}`);
      process.exit(EXIT_CODES.permissionDenied);
    }
    return;
  }

  process.stderr.write(`Unknown permissions command '${cmd}'.\n`);
  process.stderr.write(`Try 'godmode permissions --help' for more information.\n`);
  process.exit(EXIT_CODES.usage);
}

async function explainResource(extension: string, iface: string, target: string, method: string): Promise<string> {
  if (iface === 'mcp') return target;
  if (iface === 'api' || iface === 'graphql') {
    try {
      const manifest = await loadManifest(extension, iface);
      const normalizedMethod = method.toLowerCase();
      if (target.startsWith('/')) {
        const exact = manifest.routes.find((route) => route.method === normalizedMethod && route.path === target);
        if (exact) return resourceFromSegments(exact.segments);
      }
      const segments = target
        .replace(/^\/+/, '')
        .split(/[/.]/)
        .filter(Boolean);
      const match = matchRoute(manifest, segments, normalizedMethod);
      if (match) return resourceFromSegments(match.route.segments);
      return resourceFromRawPath(target);
    } catch {
      return target.replace(/^\/+/, '').replace(/\//g, '.').replace(/^v\d+\./i, '') || '*';
    }
  }
  return target.replace(/^\/+/, '').replace(/\//g, '.').replace(/^v\d+\./i, '') || '*';
}

// ── interface dispatch ──

async function runInterface(iface: string, extensionName: string, rest: string[]) {
  if (iface === 'skill') {
    process.stderr.write(`Skill interface not yet implemented.\n`);
    process.exit(EXIT_CODES.usage);
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
    process.exit(EXIT_CODES.usage);
  }

  await handler.execute();
}

main().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
