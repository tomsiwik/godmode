import { loadEnv } from './env.js';
import {
  loadManifest,
  loadMultiManifest,
  findInstalledManifestSync,
} from './config.js';
import type { InterfaceKey } from './spec.js';
import { parseArgs } from './args.js';
import { showHelp, showExtensionOverview, showExtensionVersion, showVersion } from './help.js';
import { getInterface } from './interfaces.js';
import { EXIT_CODES } from './exit-codes.js';
import { warnSettingsErrors } from './settings.js';
import { BUILTINS } from './builtins.js';

loadEnv();

// ── grammar ──────────────────────────────────────────────────
//
//   godmode <built-in> <command> [args]        — core extension (ext, agent, ...)
//   godmode <extension> <interface> [args]     — user-installed: interface REQUIRED
//
// No inference. The extension's manifest declares which interfaces exist;
// the user picks one explicitly each time. Nested help drills at every
// level: `godmode stripe --help` → extension overview,
// `godmode stripe api --help` → interface help, etc.

const VALID_INTERFACES = new Set<InterfaceKey | 'skill'>(['api', 'graphql', 'mcp', 'command', 'orchestrator', 'skill']);

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

  // Core extensions — their `command` interface is implicit.
  const builtin = BUILTINS.get(extensionSlug);
  if (builtin) {
    await builtin.run(rest);
    return;
  }

  // User extensions — interface is required.
  const multi = findInstalledManifestSync(extensionSlug);
  if (!multi) {
    process.stderr.write(`'${extensionSlug}' is not an installed extension.\n`);
    process.stderr.write(`Try 'godmode ext list' to see installed extensions.\n`);
    process.stderr.write(`Try 'godmode --help' for more information.\n`);
    process.exit(EXIT_CODES.notFound);
  }

  const declared = Object.keys(multi.interfaces) as InterfaceKey[];
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
