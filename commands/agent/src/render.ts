import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HelpPage } from 'godmode/help';
import { latestTurn, runPath, timestamp, turnDir } from './store.js';
import { normalizeTurn } from './harnesses.js';
import type { NormalizedEvent, OutputMode, RunRecord, TurnRecord } from './types.js';

export function renderTurn(turn: TurnRecord, outputMode: OutputMode): string {
  if (outputMode === 'assistant-text') return turn.assistant.text;
  if (outputMode === 'raw') {
    const stdout = existsSync(turn.paths.stdout) ? readFileSync(turn.paths.stdout, 'utf-8') : '';
    const stderr = existsSync(turn.paths.stderr) ? readFileSync(turn.paths.stderr, 'utf-8') : '';
    return JSON.stringify({ stdout, stderr }, null, 2);
  }
  if (outputMode === 'events') {
    return existsSync(turn.paths.events) ? readFileSync(turn.paths.events, 'utf-8').trimEnd() : '';
  }
  return JSON.stringify(turn, null, 2);
}

export function renderStatus(run: RunRecord) {
  return JSON.stringify(run, null, 2);
}

export function writeEvents(path: string, events: NormalizedEvent[]) {
  writeFileSyncSafe(path, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

function writeFileSyncSafe(path: string, content: string) {
  writeFileSync(path, content);
}

export function attachHelp() {
  return [
    'Usage: godmode agent attach run <id>',
    '   or: godmode agent attach session <zmx-session-id>',
  ].join('\n');
}

export class AgentHelp extends HelpPage {
  usage() {
    return [
      'godmode agent start [--harness <name>] [--model <id>] <prompt>',
      'godmode agent send  [--harness <name>] [--model <id>] <prompt>',
      'godmode agent attach run <id>',
      'godmode agent attach session <session-id>',
      'godmode agent output [id] [--json|--assistant-text|--events|--raw]',
      'godmode agent status [id]',
      'godmode agent list',
    ];
  }
  sections() {
    return [
      { title: 'Options:', rows: [
        ['    --harness <name>', 'coding agent harness (claude, codex, gemini, etc.)'],
        ['    --model <id>', 'model identifier passed to the harness'],
        ['    --effort <level>', 'effort level passed to the harness'],
        ['    --json', 'output machine-readable events'],
        ['    --follow', 'stream output until the run completes'],
      ] as string[][] },
      { title: 'Shortcuts:', rows: [
        ['godmode agent <prompt>', 'send prompt to active run, or start a new run'],
      ] as string[][] },
    ];
  }
}

export function agentHelp() {
  // Back-compat: returns the rendered string. Callers that do console.log(agentHelp())
  // keep working while the new class-based API is adopted.
  const lines: string[] = [];
  const origLog = console.log;
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    new AgentHelp().render();
  } finally {
    console.log = origLog;
  }
  return lines.join('\n');
}

export function followOutput(run: RunRecord, turn: number, outputMode: OutputMode, writer: Pick<typeof process.stdout, 'write'>) {
  const dir = turnDir(run.id, turn);
  const stdoutPath = resolve(dir, 'stdout.log');
  const stderrPath = resolve(dir, 'stderr.log');
  const statePath = runPath(run.id);
  let assistant = '';

  const emit = (event: NormalizedEvent) => {
    if (outputMode === 'events') writer.write(`${JSON.stringify(event)}\n`);
    if (outputMode === 'assistant-text') {
      if (event.type === 'assistant.delta' && event.text) writer.write(event.text);
      if (event.type === 'assistant.completed' && !assistant && event.text) writer.write(event.text);
    }
  };

  streamFile(stdoutPath, (line) => {
    const normalized = normalizeTurn(run.harness, run.id, turn, `${line}\n`, '', timestamp());
    for (const event of normalized.events) {
      if (event.type === 'assistant.delta' && event.text) assistant += event.text;
      emit(event);
    }
  }, () => (readJson<RunRecord>(statePath)?.status ?? 'completed') === 'running');

  if (outputMode === 'assistant-text') writer.write('\n');
  if (outputMode === 'events' && existsSync(stderrPath)) {
    for (const line of readFileSync(stderrPath, 'utf-8').split(/\r?\n/).filter(Boolean)) {
      writer.write(`${JSON.stringify({ ts: timestamp(), id: run.id, turn, type: 'warning', message: line })}\n`);
    }
  }
}

function streamFile(path: string, onLine: (line: string) => void, until: () => boolean) {
  let offset = 0;
  let pending = '';
  while (true) {
    if (existsSync(path)) {
      const size = statSync(path).size;
      if (size > offset) {
        const fd = openSync(path, 'r');
        const buffer = Buffer.alloc(size - offset);
        try {
          const bytes = buffer.length ? readSync(fd, buffer, 0, buffer.length, offset) : 0;
          offset += bytes;
          pending += buffer.toString('utf-8', 0, bytes);
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() ?? '';
          for (const line of lines) if (line) onLine(line);
        } finally {
          closeSync(fd);
        }
      }
    }
    if (!until()) {
      if (pending) onLine(pending);
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export { latestTurn };
