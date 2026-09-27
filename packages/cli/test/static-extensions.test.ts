import { beforeEach, describe, expect, it } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const cliEntry = resolve(__dirname, '..', 'dist', 'index.js');

function run(cwd: string, home: string, ...args: string[]) {
  return runWithEnv(cwd, home, {}, ...args);
}

function runWithEnv(cwd: string, home: string, env: Record<string, string>, ...args: string[]) {
  try {
    return {
      code: 0,
      output: execSync(
        `node ${JSON.stringify(cliEntry)} ${args.map((arg) => JSON.stringify(arg)).join(' ')} 2>&1`,
        { cwd, encoding: 'utf-8', timeout: 10_000, env: { ...process.env, HOME: home, ...env } },
      ).trim(),
    };
  } catch (error: any) {
    return {
      code: error.status ?? 1,
      output: `${error.stdout || ''}${error.stderr || ''}`.trim(),
    };
  }
}

function runAsync(cwd: string, home: string, ...args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [cliEntry, ...args], {
      cwd,
      env: { ...process.env, HOME: home },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 10_000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveRun({ code: code ?? 1, output: output.trim() });
    });
  });
}

async function writeManifest(dir: string, lines: string[]): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'manifest.yaml'), lines.join('\n') + '\n');
}

describe('static extension interfaces', () => {
  let root: string;
  let home: string;

  beforeEach(async () => {
    root = await mkdtemp(resolve(tmpdir(), 'godmode-static-'));
    home = resolve(root, 'home');
  });

  it('installs a command extension, dispatches it, and generates SKILL.md', async () => {
    const dir = resolve(root, 'demo');
    await writeManifest(dir, [
      'name: demo',
      'slug: demo',
      'interfaces:',
      '  command:',
      '    commands:',
      '      - name: run',
      '        command: echo',
      '        args: ["demo command route"]',
      '        summary: Run the wrapped command',
    ]);

    expect(run(root, home, 'ext', 'install', dir).output).toContain('Registered "demo"');
    expect(run(root, home, 'demo', 'command', 'run').output).toContain('demo command route');

    const skillPath = resolve(root, '.godmode', 'extensions', 'demo.SKILL.md');
    expect(await readFile(skillPath, 'utf-8')).toContain('godmode demo command run');
    expect(run(root, home, 'ext', 'skill', 'demo').output).toContain('godmode demo command run');

    expect(run(root, home, 'ext', 'uninstall', 'demo').code).toBe(0);
    expect(existsSync(skillPath)).toBe(false);
  });

  it('installs an orchestrator extension and dry-runs its call sequence', async () => {
    const dir = resolve(root, 'orch');
    await writeManifest(dir, [
      'name: orch',
      'slug: orch',
      'interfaces:',
      '  orchestrator:',
      '    calls:',
      '      - name: run',
      '        call: ext list',
      '        summary: Run a godmode command sequence',
    ]);

    expect(run(root, home, 'ext', 'install', dir).code).toBe(0);
    const result = runWithEnv(root, home, { GODMODE_DRY_RUN: '1' }, 'orch', 'orchestrator', 'run');
    expect(result.output).toContain('GODMODE ext list');
    expect(run(root, home, 'ext', 'list').output).toContain('orch');
  });

  it('installs an api extension from a local spec file', async () => {
    const dir = resolve(root, 'api-demo');
    await mkdir(dir, { recursive: true });
    const openApi = resolve(dir, 'openapi.json');
    await writeFile(openApi, JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Demo', version: '1.0.0' },
      servers: [{ url: 'https://example.com' }],
      paths: { '/ping': { get: { summary: 'Ping' } } },
    }));
    await writeManifest(dir, [
      'name: api-demo',
      'slug: api-demo',
      'interfaces:',
      '  api:',
      '    spec: ./openapi.json',
    ]);

    expect(run(root, home, 'ext', 'install', dir).code).toBe(0);
    expect(runWithEnv(root, home, { GODMODE_DRY_RUN: '1' }, 'api-demo', 'api', 'GET', 'ping').output)
      .toContain('GET https://example.com/ping');
  });

  it('invokes stdio MCP manifests through a spawned MCP server', async () => {
    const serverPath = resolve(root, 'stdio-mcp-server.js');
    await writeFile(serverPath, `
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString('utf-8');
  while (true) {
    const newline = buffer.indexOf('\\n');
    if (newline < 0) return;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === undefined) continue;
    if (message.method === 'initialize') {
      send(message.id, { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '0.0.0' } });
    } else if (message.method === 'tools/call') {
      send(message.id, { content: [{ type: 'text', text: 'stdio pong' }] });
    } else {
      send(message.id, {});
    }
  }
});
function send(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');
}
`);
    const dir = resolve(root, 'stdio-mcp');
    await writeManifest(dir, [
      'name: stdio-mcp',
      'slug: stdio-mcp',
      'interfaces:',
      '  mcp:',
      `    url: "stdio:node ${serverPath}"`,
    ]);

    expect(run(root, home, 'ext', 'install', dir).output).toContain('mcp=1');
    expect(run(root, home, 'stdio-mcp', 'mcp', 'run').output).toContain('stdio pong');
  });

  it('rejects incomplete command and orchestrator manifests at install time', async () => {
    const badCommand = resolve(root, 'bad-command');
    await writeManifest(badCommand, [
      'name: bad-command',
      'interfaces:',
      '  command:',
      '    commands:',
      '      - name: run',
    ]);
    const commandResult = run(root, home, 'ext', 'install', badCommand);
    expect(commandResult.code).not.toBe(0);
    expect(commandResult.output).toContain('command is required');

    const badOrchestrator = resolve(root, 'bad-orchestrator');
    await writeManifest(badOrchestrator, [
      'name: bad-orchestrator',
      'interfaces:',
      '  orchestrator:',
      '    calls:',
      '      - name: run',
      '        call: []',
    ]);
    const orchestratorResult = run(root, home, 'ext', 'install', badOrchestrator);
    expect(orchestratorResult.code).not.toBe(0);
    expect(orchestratorResult.output).toContain('call must contain non-empty commands');
  });

  it('refuses built-in slugs declared inside manifests at install time', async () => {
    const dir = resolve(root, 'looks-safe');
    await writeManifest(dir, [
      'name: Looks Safe',
      'slug: ext',
      'interfaces:',
      '  command:',
      '    commands:',
      '      - name: run',
      '        command: echo',
    ]);

    const result = run(root, home, 'ext', 'install', dir);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('built-in godmode extension');
  });
});
