import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { subHelpRules } from '../src/help-rules.js';
import { gmIn, gmResult } from './adapter';

// The fixture program prints what it was run with, so each test reads back the
// exact argv and environment godmode handed over.
const PROGRAM = `
const args = process.argv.slice(2);
if (args[0] === 'fail') process.exit(Number(args[args.indexOf('--code') + 1]));
console.log(JSON.stringify({
  args,
  extension: process.env.GODMODE_EXTENSION,
  command: process.env.GODMODE_COMMAND,
}));
`;

const MANIFEST = `
name: Tool
slug: tool
description: A fixture program whose commands echo their arguments back.
interfaces:
  command:
    run: [node, ./program.mjs]
    commands:
      - name: greet
        summary: Print a greeting
        description: Greets one person. The greeting is plain unless shout is set.
        group: Words
        args:
          - name: name
            description: who to greet
            required: true
          - name: shout
            type: boolean
            description: upper-case the greeting
          - name: times
            type: number
            description: how often to repeat it
            default: "1"
          - name: tone
            choices: [warm, dry]
          - name: tag
            repeatable: true
        examples:
          - godmode tool greet name=World shout=true
      - name: copy
        summary: Copy files
        group: Files
        argv: [cp]
        args:
          - name: from
            positional: true
            required: true
          - name: to
            positional: true
            repeatable: true
          - name: force
            type: boolean
            flag: -f
      - name: raw
        summary: Hand everything to the program
        group: Files
        passthrough: true
      - name: fail
        summary: Exit with a status
        args:
          - name: code
            type: number
            required: true
`;

async function project(manifest = MANIFEST, files: Record<string, string> = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'godmode-command-'));
  const extension = resolve(root, 'tool');
  await mkdir(extension, { recursive: true });
  await writeFile(resolve(extension, 'manifest.yaml'), manifest);
  await writeFile(resolve(extension, 'program.mjs'), PROGRAM);
  for (const [name, text] of Object.entries(files)) await writeFile(resolve(extension, name), text);
  return { root, extension, install: gmResult(root, 'ext', 'install', extension) };
}

const ran = (output: string) => JSON.parse(output) as { args: string[]; extension: string; command: string };

describe('command interface', () => {
  it('installs a manifest and registers its commands', async () => {
    const { root, install } = await project();
    expect(install.status).toBe(0);
    expect(install.output).toContain('Registered "tool" [project] - interfaces: command=4');
    expect(gmIn(root, 'ext', 'list')).toContain('[command]');
  });

  it('runs a command without naming the interface, as flags of the program', async () => {
    const { root } = await project();
    const result = ran(gmIn(root, 'tool', 'greet', 'name=World', 'shout=true', 'times=2'));
    expect(result.args).toEqual(['greet', '--name', 'World', '--shout', '--times', '2']);
    expect(result).toMatchObject({ extension: 'tool', command: 'greet' });
  });

  it('accepts the interface name and both flag spellings', async () => {
    const { root } = await project();
    expect(ran(gmIn(root, 'tool', 'command', 'greet', '--name', 'A B', '--shout')).args).toEqual([
      'greet', '--name', 'A B', '--shout',
    ]);
    expect(ran(gmIn(root, 'tool', 'greet', '--name=x=y', 'shout=false', 'tag=a', 'tag=b')).args).toEqual([
      'greet', '--name', 'x=y', '--tag', 'a', '--tag', 'b',
    ]);
  });

  it('passes positional arguments in order, before flags, under the declared argv', async () => {
    const { root } = await project();
    expect(ran(gmIn(root, 'tool', 'copy', 'a.txt', 'b.txt', 'c.txt', 'force=true')).args).toEqual([
      'cp', 'a.txt', 'b.txt', 'c.txt', '-f',
    ]);
    expect(ran(gmIn(root, 'tool', 'copy', 'from=a.txt', '--', 'x=y')).args).toEqual(['cp', 'a.txt', 'x=y']);
  });

  it('hands a passthrough command every token unchanged', async () => {
    const { root } = await project();
    expect(ran(gmIn(root, 'tool', 'raw', '-x', '--anything', 'k=v', '--', 'tail')).args).toEqual([
      'raw', '-x', '--anything', 'k=v', '--', 'tail',
    ]);
  });

  it.each([
    [['greet', 'nme=World'], "Unknown argument 'nme' for greet. Arguments: name, shout, times, tone, tag."],
    [['greet'], "Missing required argument 'name' for greet."],
    [['greet', 'name=a', 'name=b'], "Argument 'name' was given more than once."],
    [['greet', 'name=a', 'times=many'], "Argument 'times' must be a number, got 'many'."],
    [['greet', 'name=a', 'tone=loud'], "Argument 'tone' must be one of: warm, dry."],
    [['greet', 'name=a', 'shout=maybe'], "Argument 'shout' is a flag; use shout=true or shout=false."],
    [['greet', 'name=a', 'stray'], "Unexpected argument 'stray' for greet."],
    [['greet', '--name'], "Argument 'name' of greet needs a value."],
    [['greet', 'name=a', '-x'], "Unknown argument '-x' for greet."],
  ])('refuses %j before the program runs', async (args, message) => {
    const { root } = await project();
    const result = gmResult(root, 'tool', ...args);
    expect(result.status).toBe(2);
    expect(result.output).toContain(message);
    expect(result.output).toContain("Try 'godmode tool greet --help' for more information.");
    expect(result.output).not.toContain('"args"');
  });

  it('names close matches for an unknown command', async () => {
    const { root } = await project();
    const result = gmResult(root, 'tool', 'gret');
    expect(result.status).toBe(3);
    expect(result.output).toContain("'gret' is not a tool command.");
    expect(result.output).toContain('Did you mean: greet?');
  });

  it("exits with the program's status", async () => {
    const { root } = await project();
    expect(gmResult(root, 'tool', 'fail', 'code=7').status).toBe(7);
  });

  it('prints the invocation instead of running it in a dry run', async () => {
    const { root, extension } = await project();
    expect(gmIn(root, 'tool', 'greet', 'name=A B', '--dry-run')).toBe(
      `RUN node ${resolve(extension, 'program.mjs')} greet --name 'A B'`,
    );
  });

  it('reports a program that is not installed', async () => {
    const { root } = await project(MANIFEST.replace('[node, ./program.mjs]', 'godmode-no-such-program'));
    const result = gmResult(root, 'tool', 'greet', 'name=a');
    expect(result.status).toBe(3);
    expect(result.output).toContain("'godmode-no-such-program' was not found");
  });

  it('applies permission rules per command', async () => {
    const { root } = await project();
    await writeFile(
      resolve(root, '.godmode', 'settings.yaml'),
      'extensions:\n  tool:\n    permissions:\n      allow:\n        - resources: ["*"]\n      deny:\n        - resources: [copy]\n',
    );
    expect(ran(gmIn(root, 'tool', 'greet', 'name=a')).command).toBe('greet');
    const denied = gmResult(root, 'tool', 'copy', 'a.txt');
    expect(denied.status).toBe(4);
    expect(denied.output).toContain('Blocked: denied by permissions for tool');
    expect(denied.output).toContain('- resources: [copy]');
  });

  it('reads commands from a spec file beside the manifest', async () => {
    const manifest = 'name: Tool\nslug: tool\ninterfaces:\n  command:\n    run: [node, ./program.mjs]\n    spec: ./commands.json\n';
    const spec = JSON.stringify({
      version: '2.1.0',
      commands: [{ name: 'ping', summary: 'Answer', args: [{ name: 'host', positional: true }] }],
    });
    const { root, install } = await project(manifest, { 'commands.json': spec });
    expect(install.output).toContain('command=1');
    expect(ran(gmIn(root, 'tool', 'ping', 'example.test')).args).toEqual(['ping', 'example.test']);
    expect(gmIn(root, 'tool', '--version')).toContain('2.1.0');
  });

  it.each([
    ['    commands: []\n', 'the command interface declares no commands'],
    ['    commands:\n      - name: a\n      - name: a\n', "command 'a' is declared twice"],
    ['    commands:\n      - name: Bad_Name\n', "invalid command name 'Bad_Name'"],
    ['    commands:\n      - name: a\n        args:\n          - name: help\n', "cannot declare 'help'"],
    [
      '    commands:\n      - name: a\n        args:\n          - {name: x, positional: true, repeatable: true}\n          - {name: y, positional: true}\n',
      'only the last positional argument may be repeatable',
    ],
  ])('rejects a manifest whose commands are invalid (%#)', async (commands, message) => {
    const manifest = `name: Tool\nslug: tool\ninterfaces:\n  command:\n    run: node\n${commands}`;
    const { install } = await project(manifest);
    expect(install.status).not.toBe(0);
    expect(install.output).toContain(message);
  });
});

describe('command interface help', () => {
  it('lists every command of the extension under its group', async () => {
    const { root } = await project();
    const help = gmIn(root, 'tool', '--help');
    expect(help).toContain('Usage: godmode tool <command> [args]');
    expect(help).toContain('A fixture program whose commands echo their arguments back.');
    expect(help).toMatch(/Words:\n {2}greet\s+Print a greeting/);
    expect(help).toMatch(/Files:\n {2}copy\s+Copy files\n {2}raw\s+Hand everything to the program/);
    expect(help).toMatch(/Commands:\n {2}fail\s+Exit with a status/);
    expect(help).toContain('Run "godmode tool <command> --help" for a command\'s arguments.');
    expect(gmIn(root, 'tool', 'command', '--help')).toContain('Usage: godmode tool <command> [args]');
  });

  it("shows one command's arguments, notes and examples", async () => {
    const { root } = await project();
    const help = gmIn(root, 'tool', 'greet', '--help');
    expect(help).toContain('Print a greeting\n\nGreets one person. The greeting is plain unless shout is set.');
    expect(help).toContain('Usage: godmode tool greet [args]');
    expect(help).toMatch(/name=<value>\s+who to greet \(required\)/);
    expect(help).toMatch(/shout=true\s+upper-case the greeting/);
    expect(help).toMatch(/times=<number>\s+how often to repeat it \(default 1\)/);
    expect(help).toMatch(/tone=<warm\|dry>/);
    expect(help).toMatch(/tag=<value>\s+\(repeatable\)/);
    expect(help).toContain('godmode tool greet name=World shout=true');
    expect(help).toContain('Write an argument as name=value or --name value.');
    expect(gmIn(root, 'tool', 'copy', '--help')).toContain('Usage: godmode tool copy <from> [<to>...] [args]');
  });

  it.each([[['tool', '--help']], [['tool', 'greet', '--help']], [['tool', 'copy', '--help']], [['tool', 'raw', '--help']]])(
    'keeps %j within the help format rules',
    async (args) => {
      const { root } = await project();
      const help = gmIn(root, ...args);
      const broken = subHelpRules
        .map((rule) => ({ rule: rule.id, result: rule.check(help) }))
        .filter(({ result }) => !result.ok);
      expect(broken).toEqual([]);
    },
  );
});
