import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HARNESSES, agentHelp, runAgentCommand, type ExecResult, type Executor } from '../src/index.js';

function makeTempDir() {
  return mkdtempSync(resolve(tmpdir(), 'godmode-coding-agents-'));
}

function createExecutor(handler: (command: string, args: string[], stdio?: 'pipe' | 'inherit' | 'ignore') => ExecResult): Executor {
  return (command, args, stdio) => handler(command, args, stdio);
}

function redirectedPaths(shell: string) {
  const stdoutPath = shell.match(/> '([^']+stdout\.log)'/)?.[1];
  const stderrPath = shell.match(/2> '([^']+stderr\.log)'/)?.[1];
  const exitCodePath = shell.match(/> '([^']+exit-code\.txt)'/)?.[1];
  if (!stdoutPath || !stderrPath || !exitCodePath) throw new Error(`missing redirected paths in ${shell}`);
  return { stdoutPath, stderrPath, exitCodePath };
}

describe('help', () => {
  it('shows subcommands', async () => {
    const writes: string[] = [];
    const code = await runAgentCommand(['help'], {
      writer: { write: (chunk: string) => { writes.push(chunk); return true; } },
    });
    expect(code).toBe(0);
    expect(writes.join('')).toContain('godmode agent attach run <id>');
    expect(agentHelp()).toContain('godmode agent output [id]');
  });
});

describe('harness builders', () => {
  it('builds resumable structured commands', () => {
    expect(HARNESSES.claude.buildTurnArgs({ prompt: 'hi', model: 'sonnet', effort: 'high', passthroughArgs: [], resumeToken: 'abc' })).toEqual([
      '-p', '--verbose', '--output-format', 'stream-json', '--resume', 'abc', '--model', 'sonnet', '--effort', 'high', 'hi',
    ]);
    expect(HARNESSES.gemini.buildTurnArgs({ prompt: 'hi', passthroughArgs: [], resumeToken: 'abc' })).toEqual([
      '--resume', 'abc', '-p', 'hi', '-o', 'stream-json',
    ]);
    expect(HARNESSES.pi.buildTurnArgs({ prompt: 'hi', passthroughArgs: [], resumeToken: 'yes', sessionDir: '/tmp/pi' })).toEqual([
      '--print', '--mode', 'json', '--session-dir', '/tmp/pi', '--continue', 'hi',
    ]);
  });
});

describe('start/send lifecycle', () => {
  it('starts a claude run, stores normalized output, and resumes on send', async () => {
    const cwd = makeTempDir();
    const writes: string[] = [];
    let turn = 0;

    const executor = createExecutor((command, args) => {
      if (command === 'claude' && args[0] === '--help') return { status: 0, stdout: 'Usage: claude', stderr: '' };
      if (command === 'zmx' && args[0] === '--help') return { status: 0, stdout: 'Usage: zmx', stderr: '' };
      if (command === 'zmx' && args[0] === 'run') {
        turn += 1;
        const shell = args[4];
        const { stdoutPath, stderrPath, exitCodePath } = redirectedPaths(shell);
        mkdirSync(resolve(stdoutPath, '..'), { recursive: true });
        if (turn === 1) {
          writeFileSync(stdoutPath, [
            JSON.stringify({ type: 'system', subtype: 'init', session_id: 'claude-session-1' }),
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ONE' }] }, session_id: 'claude-session-1' }),
            JSON.stringify({ type: 'result', subtype: 'success', is_error: false, session_id: 'claude-session-1', result: 'ONE', duration_ms: 123, usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 5 } }),
          ].join('\n'));
        } else {
          expect(shell).toContain(`'--resume' 'claude-session-1'`);
          writeFileSync(stdoutPath, [
            JSON.stringify({ type: 'system', subtype: 'init', session_id: 'claude-session-1' }),
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'TWO' }] }, session_id: 'claude-session-1' }),
            JSON.stringify({ type: 'result', subtype: 'success', is_error: false, session_id: 'claude-session-1', result: 'TWO', duration_ms: 77, usage: { input_tokens: 8, output_tokens: 1, cache_read_input_tokens: 7 } }),
          ].join('\n'));
        }
        writeFileSync(stderrPath, '');
        writeFileSync(exitCodePath, '0');
        return { status: 0, stdout: 'command sent', stderr: '' };
      }
      throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
    });

    let code = await runAgentCommand(['start', '--harness', 'claude', '--model', 'sonnet', '--effort', 'high', 'Reply exactly ONE'], {
      executor,
      cwd,
      writer: { write: (chunk: string) => { writes.push(chunk); return true; } },
    });
    expect(code).toBe(0);
    const first = JSON.parse(writes.join(''));
    expect(first.assistant.text).toBe('ONE');
    expect(first.sessions.claude).toBe('claude-session-1');
    writes.length = 0;

    code = await runAgentCommand(['send', 'Reply exactly TWO'], {
      executor,
      cwd,
      writer: { write: (chunk: string) => { writes.push(chunk); return true; } },
    });
    expect(code).toBe(0);
    const second = JSON.parse(writes.join(''));
    expect(second.assistant.text).toBe('TWO');
    expect(second.turn).toBe(2);

    writes.length = 0;
    code = await runAgentCommand(['status'], {
      executor,
      cwd,
      writer: { write: (chunk: string) => { writes.push(chunk); return true; } },
    });
    expect(code).toBe(0);
    const status = JSON.parse(writes.join(''));
    expect(status.lastTurn).toBe(2);
    expect(status.sessions.claude).toBe('claude-session-1');
  });

  it('stores and renders gemini events and assistant text', async () => {
    const cwd = makeTempDir();
    const writes: string[] = [];

    const executor = createExecutor((command, args, stdio) => {
      if (command === 'gemini' && args[0] === '--help') return { status: 0, stdout: 'Usage: gemini', stderr: '' };
      if (command === 'zmx' && args[0] === '--help') return { status: 0, stdout: 'Usage: zmx', stderr: '' };
      if (command === 'zmx' && args[0] === 'run') {
        const shell = args[4];
        const { stdoutPath, stderrPath, exitCodePath } = redirectedPaths(shell);
        mkdirSync(resolve(stdoutPath, '..'), { recursive: true });
        writeFileSync(stdoutPath, [
          JSON.stringify({ type: 'init', session_id: 'gemini-session-1' }),
          JSON.stringify({ type: 'message', role: 'assistant', content: 'DO', delta: true }),
          JSON.stringify({ type: 'message', role: 'assistant', content: 'NE', delta: true }),
          JSON.stringify({ type: 'result', status: 'success', stats: { input_tokens: 3, output_tokens: 1, cached: 2, total_tokens: 6, duration_ms: 42 } }),
        ].join('\n'));
        writeFileSync(stderrPath, 'Loaded cached credentials.');
        writeFileSync(exitCodePath, '0');
        return { status: 0, stdout: 'command sent', stderr: '' };
      }
      if (command === 'zmx' && args[0] === 'attach') return { status: 0, stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${command} ${args.join(' ')} stdio=${stdio}`);
    });

    let id = '';

    let code = await runAgentCommand(['start', '--harness', 'gemini', 'Reply exactly DONE'], {
      executor,
      cwd,
      writer: { write: (chunk: string) => { writes.push(chunk); return true; } },
    });
    expect(code).toBe(0);
    const turn = JSON.parse(writes.join(''));
    id = turn.id;
    expect(turn.assistant.text).toBe('DONE');
    expect(turn.status).toBe('completed');

    writes.length = 0;
    code = await runAgentCommand(['output', '--assistant-text'], {
      executor,
      cwd,
      writer: { write: (chunk: string) => { writes.push(chunk); return true; } },
    });
    expect(code).toBe(0);
    expect(writes.join('').trim()).toBe('DONE');

    writes.length = 0;
    code = await runAgentCommand(['output', '--events'], {
      executor,
      cwd,
      writer: { write: (chunk: string) => { writes.push(chunk); return true; } },
    });
    expect(code).toBe(0);
    expect(writes.join('')).toContain('assistant.delta');
    expect(writes.join('')).toContain('turn.completed');

    code = await runAgentCommand(['attach', 'run', id], { executor, cwd });
    expect(code).toBe(0);
  });

  it('attaches by session id and uses inherit stdio', async () => {
    const executor = createExecutor((command, args, stdio) => {
      expect(command).toBe('zmx');
      expect(args).toEqual(['attach', 'my-session']);
      expect(stdio).toBe('inherit');
      return { status: 0, stdout: '', stderr: '' };
    });
    const code = await runAgentCommand(['attach', 'session', 'my-session'], { executor });
    expect(code).toBe(0);
  });
});
