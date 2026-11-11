import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { runtimeFlags, type ParsedArgs } from '../args.js';
import { EXIT_CODES } from '../exit-codes.js';
import { showCommandHelp, showCommandList } from '../help.js';
import { checkPermission, suggestedAllowRule } from '../permissions.js';
import type {
  CommandArg,
  CommandInterfaceData,
  CommandInterfaceSource,
  CommandSpec,
  InterfaceData,
  ManifestSource,
} from '../spec.js';
import { Interface } from './base.js';

const COMMAND_NAME = /^[a-z0-9][a-z0-9-]*$/;
const ARG_NAME = /^[A-Za-z][\w-]*$/;
const TRUE = new Set(['true', '1', 'yes']);
const FALSE = new Set(['false', '0', 'no']);

/** What a parsed invocation hands to the program, or why it cannot run. */
type Plan = { argv: string[] } | { error: string };

/**
 * A local program exposed as subcommands: `godmode <extension> <command> [args]`.
 * The manifest declares each command and its arguments, so help, validation and
 * permissions work without running the program.
 */
export class CommandInterface extends Interface {
  static readonly key = 'command';
  static readonly usage = ' <command> [args]';

  static async compile(name: string, source: ManifestSource): Promise<InterfaceData> {
    const declared = source.interfaces.command as CommandInterfaceSource | undefined;
    if (!declared) throw new Error(`Interface 'command' not declared on '${name}'`);
    const run = programOf(declared.run, name);
    const file = declared.spec ? await readSpec(declared.spec) : undefined;
    const commands = [...(file?.commands ?? []), ...(declared.commands ?? [])];
    checkCommands(commands, name);
    return {
      type: 'command',
      specVersion: file?.version || 'static',
      versions: [],
      resourceDescriptions: Object.fromEntries(
        commands.filter((command) => command.summary).map((command) => [command.name, command.summary!]),
      ),
      routes: commands.map((command) => ({
        path: command.name,
        method: 'command',
        summary: command.summary || '',
        version: '',
        ...(command.group ? { tag: command.group } : {}),
        segments: [{ value: command.name, isParam: false }],
      })),
      run,
      commands,
    } satisfies CommandInterfaceData;
  }

  /** The program's own arguments are parsed against the command's declaration later. */
  static parseArgs(args: string[]): ParsedArgs {
    const literal = args.indexOf('--');
    const own = literal === -1 ? args : args.slice(0, literal);
    const name = args[0] && !args[0].startsWith('-') ? args[0] : undefined;
    return {
      segments: name ? [name] : [],
      method: 'command',
      explicitMethod: false,
      headers: {},
      query: {},
      body: {},
      all: false,
      help: own.includes('--help') || own.includes('-h'),
      ...runtimeFlags(),
    };
  }

  private get data(): CommandInterfaceData {
    return this.ctx.multi.interfaces.command as CommandInterfaceData;
  }

  private get command(): CommandSpec | undefined {
    const name = this.ctx.parsed.segments[0];
    return this.data.commands.find((command) => command.name === name);
  }

  showHelp(): void {
    const { multi, parsed } = this.ctx;
    const command = this.command;
    if (command) return showCommandHelp(multi, command);
    if (parsed.segments[0]) this.unknownCommand(parsed.segments[0]);
    showCommandList(multi);
  }

  validate(): string | null {
    const command = this.command;
    if (!command) return null;
    const plan = planInvocation(this.data, command, this.ctx.rawRest.slice(1));
    return 'error' in plan
      ? `${plan.error}\nTry 'godmode ${this.ctx.extensionName} ${command.name} --help' for more information.`
      : null;
  }

  async execute(): Promise<void> {
    const { extensionName, parsed, rawRest } = this.ctx;
    const command = this.command;
    if (!command) this.unknownCommand(parsed.segments[0]);

    const input = { extension: extensionName, resource: command.name, method: 'command' };
    const check = checkPermission(input);
    if (!check.allowed) {
      process.stderr.write(`Blocked: ${check.reason}\n`);
      process.stderr.write(`Suggested allow rule:\n${suggestedAllowRule(input)}\n`);
      process.exit(EXIT_CODES.permissionDenied);
    }

    const plan = planInvocation(this.data, command, rawRest.slice(1));
    if ('error' in plan) throw new Error(plan.error);
    const [program, ...args] = plan.argv;
    if (parsed.dryRun) {
      process.stdout.write(`RUN ${plan.argv.map(shellWord).join(' ')}\n`);
      return;
    }

    const result = spawnSync(program, args, {
      stdio: 'inherit',
      env: { ...process.env, GODMODE_EXTENSION: extensionName, GODMODE_COMMAND: command.name },
    });
    if (result.error) {
      const missing = (result.error as NodeJS.ErrnoException).code === 'ENOENT';
      process.stderr.write(
        missing
          ? `'${program}' was not found; the '${extensionName}' extension runs it for every command.\n`
          : `Could not run '${program}': ${result.error.message}\n`,
      );
      process.exit(missing ? EXIT_CODES.notFound : 1);
    }
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  private unknownCommand(name: string): never {
    const { extensionName } = this.ctx;
    process.stderr.write(`'${name}' is not a ${extensionName} command.\n`);
    const similar = closest(name, this.data.commands.map((command) => command.name));
    if (similar.length) process.stderr.write(`Did you mean: ${similar.join(', ')}?\n`);
    process.stderr.write(`Try 'godmode ${extensionName} --help' for more information.\n`);
    process.exit(EXIT_CODES.notFound);
  }
}

// ── manifest ─────────────────────────────────────────────────

function programOf(run: unknown, name: string): string[] {
  const parts = typeof run === 'string' ? [run] : run;
  if (!Array.isArray(parts) || !parts.length || parts.some((part) => typeof part !== 'string' || !part)) {
    throw new Error(`${name}: interfaces.command.run must name a program, or a program and its leading arguments`);
  }
  return parts as string[];
}

async function readSpec(path: string): Promise<{ version?: string; commands: CommandSpec[] }> {
  const text = await readFile(path, 'utf-8').catch(() => {
    throw new Error(`Command spec not found: ${path}`);
  });
  const raw = (extname(path) === '.json' ? JSON.parse(text) : parseYaml(text)) as
    | { version?: unknown; commands?: unknown }
    | null;
  if (!raw || !Array.isArray(raw.commands)) throw new Error(`${path}: expected an object with a 'commands' list`);
  return {
    version: typeof raw.version === 'string' ? raw.version : undefined,
    commands: raw.commands as CommandSpec[],
  };
}

function checkCommands(commands: CommandSpec[], name: string): void {
  if (!commands.length) throw new Error(`${name}: the command interface declares no commands`);
  const seen = new Set<string>();
  for (const command of commands) {
    if (!command || typeof command.name !== 'string' || !COMMAND_NAME.test(command.name)) {
      throw new Error(`${name}: invalid command name '${command?.name}' (lowercase letters, numbers and hyphens)`);
    }
    if (seen.has(command.name)) throw new Error(`${name}: command '${command.name}' is declared twice`);
    seen.add(command.name);
    checkArgs(command, name);
  }
}

function checkArgs(command: CommandSpec, name: string): void {
  const args = command.args ?? [];
  const seen = new Set<string>();
  const where = `${name}: command '${command.name}'`;
  for (const arg of args) {
    if (!arg || typeof arg.name !== 'string' || !ARG_NAME.test(arg.name)) {
      throw new Error(`${where} has an invalid argument name '${arg?.name}'`);
    }
    if (arg.name === 'help' || arg.name === 'version') {
      throw new Error(`${where} cannot declare '${arg.name}'; godmode answers --${arg.name} itself`);
    }
    if (seen.has(arg.name)) throw new Error(`${where} declares argument '${arg.name}' twice`);
    seen.add(arg.name);
    if (arg.type && !['string', 'boolean', 'number'].includes(arg.type)) {
      throw new Error(`${where}: argument '${arg.name}' has unknown type '${arg.type}'`);
    }
  }
  const positional = args.filter((arg) => arg.positional);
  const variadic = positional.findIndex((arg) => arg.repeatable);
  if (variadic !== -1 && variadic !== positional.length - 1) {
    throw new Error(`${where}: only the last positional argument may be repeatable`);
  }
}

// ── invocation ───────────────────────────────────────────────

/** Turns the user's tokens into the program's argv, or says what is wrong with them. */
export function planInvocation(data: CommandInterfaceData, command: CommandSpec, tokens: string[]): Plan {
  const lead = [...data.run, ...(command.argv ?? [command.name])];
  if (command.passthrough) return { argv: [...lead, ...tokens] };

  const read = readTokens(command, tokens);
  if ('error' in read) return read;
  const args = command.args ?? [];
  const values = new Map<string, Array<string | true>>();
  for (const [name, value] of read.named) values.set(name, [...(values.get(name) ?? []), value]);

  const positional = args.filter((arg) => arg.positional);
  const queue = [...read.positionals];
  for (const arg of positional) {
    if (values.has(arg.name)) continue;
    const taken = arg.repeatable ? queue.splice(0) : queue.splice(0, 1);
    if (taken.length) values.set(arg.name, taken);
  }
  if (queue.length) return { error: `Unexpected argument '${queue[0]}' for ${command.name}.` };

  for (const arg of args) {
    const given = values.get(arg.name);
    if (!given) {
      if (arg.required) return { error: `Missing required argument '${arg.name}' for ${command.name}.` };
      continue;
    }
    const problem = checkValues(arg, given);
    if (problem) return { error: problem };
  }

  const argv = [...lead];
  for (const arg of positional) argv.push(...((values.get(arg.name) ?? []) as string[]));
  for (const [name, value] of read.named) {
    const arg = args.find((candidate) => candidate.name === name)!;
    if (arg.positional) continue;
    const flag = arg.flag ?? `--${arg.name}`;
    if (arg.type === 'boolean') {
      if (value === true || TRUE.has(value.toLowerCase())) argv.push(flag);
    } else {
      argv.push(flag, value as string);
    }
  }
  return { argv };
}

type Tokens = { named: Array<[string, string | true]>; positionals: string[] } | { error: string };

function readTokens(command: CommandSpec, tokens: string[]): Tokens {
  const args = command.args ?? [];
  const find = (name: string) => args.find((arg) => arg.name === name);
  const unknown = (name: string) => ({
    error:
      `Unknown argument '${name}' for ${command.name}.` +
      (args.length ? ` Arguments: ${args.map((arg) => arg.name).join(', ')}.` : ' It takes no arguments.'),
  });
  const named: Array<[string, string | true]> = [];
  const positionals: string[] = [];
  let literal = false;

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (literal) { positionals.push(token); continue; }
    if (token === '--') { literal = true; continue; }
    if (token === '--help' || token === '-h') continue;
    if (token.startsWith('--')) {
      const equals = token.indexOf('=');
      const name = equals === -1 ? token.slice(2) : token.slice(2, equals);
      const arg = find(name);
      if (!arg) return unknown(name);
      if (equals !== -1) named.push([name, token.slice(equals + 1)]);
      else if (arg.type === 'boolean') named.push([name, true]);
      else if (index + 1 < tokens.length) named.push([name, tokens[++index]]);
      else return { error: `Argument '${name}' of ${command.name} needs a value.` };
      continue;
    }
    if (/^-[A-Za-z]/.test(token)) return unknown(token);
    const equals = token.indexOf('=');
    const key = equals > 0 ? token.slice(0, equals) : '';
    if (key && ARG_NAME.test(key)) {
      if (!find(key)) return unknown(key);
      named.push([key, token.slice(equals + 1)]);
      continue;
    }
    positionals.push(token);
  }
  return { named, positionals };
}

function checkValues(arg: CommandArg, given: Array<string | true>): string | null {
  if (given.length > 1 && !arg.repeatable) return `Argument '${arg.name}' was given more than once.`;
  for (const value of given) {
    if (value === true) continue;
    if (arg.type === 'boolean' && !TRUE.has(value.toLowerCase()) && !FALSE.has(value.toLowerCase())) {
      return `Argument '${arg.name}' is a flag; use ${arg.name}=true or ${arg.name}=false.`;
    }
    if (arg.type === 'number' && (value.trim() === '' || !Number.isFinite(Number(value)))) {
      return `Argument '${arg.name}' must be a number, got '${value}'.`;
    }
    if (arg.choices?.length && !arg.choices.includes(value)) {
      return `Argument '${arg.name}' must be one of: ${arg.choices.join(', ')}.`;
    }
  }
  return null;
}

function shellWord(word: string): string {
  return /^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}

/** Command names that share a prefix with, or contain, what was typed. */
function closest(name: string, candidates: string[]): string[] {
  const head = name.slice(0, 3);
  return candidates
    .filter((candidate) => candidate.includes(name) || name.includes(candidate) || candidate.startsWith(head))
    .slice(0, 5);
}
