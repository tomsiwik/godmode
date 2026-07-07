import { removeApi, updateApi, listApis, findInstalledManifestSync, type Scope } from '../config.js';
import { showExtHelp } from '../help.js';
import { warnSettingsErrors } from '../settings.js';
import { EXIT_CODES } from '../exit-codes.js';
import type { InterfaceKey } from '../spec.js';

/** Pull `-g` / `--global` out of the args list, return the remaining args
 *  plus the resolved scope. */
function extractScope(args: string[]): { rest: string[]; scope: Scope | undefined } {
  const rest: string[] = [];
  let global = false;
  for (const a of args) {
    if (a === '-g' || a === '--global') { global = true; continue; }
    rest.push(a);
  }
  return { rest, scope: global ? 'global' : undefined };
}

export async function runExt(rest: string[]) {
  const cmd = rest[0];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    showExtHelp();
    return;
  }

  const { rest: cmdArgs, scope } = extractScope(rest.slice(1));

  if (cmd === 'install') {
    if (!cmdArgs[0]) { console.error('Usage: godmode ext install [-g] <name|folder>'); process.exit(1); }
    const { runAdd } = await import('./add.js');
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
    const { configWizard } = await import('../prompt.js');
    await configWizard();
    return;
  }

  const multi = findInstalledManifestSync(cmd);
  if (multi) {
    const ifaces = Object.keys(multi.interfaces) as InterfaceKey[];
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
