import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HARNESSES, detectHarness, normalizeTurn } from './harnesses.js';
import { agentHelp, attachHelp, followOutput, latestTurn, renderStatus, renderTurn, writeEvents } from './render.js';
import { activeRunIdForCwd, buildShellCommand, createRun, ensureDirs, listRuns, loadRun, loadSettings, resolveRunId, saveActiveRun, saveRun, turnDir, waitForFile, writeJson } from './store.js';
import type { ExecResult, Executor, HarnessAdapter, HarnessId, OutputMode, OutputParsed, RunAgentOptions, RunRecord, StartSendParsed, TurnRecord } from './types.js';

export * from './types.js';
export { HARNESSES } from './harnesses.js';
export { agentHelp } from './render.js';

export function defaultExecutor(command: string, args: string[], stdio: 'pipe' | 'inherit' | 'ignore' = 'pipe'): ExecResult {
  const spawnStdio = stdio === 'inherit' ? 'inherit' : 'pipe';
  const result = spawnSync(command, args, { encoding: 'utf-8', stdio: spawnStdio });
  return {
    status: result.status,
    stdout: stdio === 'pipe' && typeof result.stdout === 'string' ? result.stdout : '',
    stderr: stdio === 'pipe' && typeof result.stderr === 'string' ? result.stderr : '',
    error: result.error ?? undefined,
  };
}

function parseOutputMode(args: string[]): { outputMode: OutputMode; follow: boolean; remaining: string[] } {
  let outputMode: OutputMode = 'json';
  let follow = false;
  const remaining: string[] = [];
  for (const arg of args) {
    if (arg === '--json') outputMode = 'json';
    else if (arg === '--assistant-text') outputMode = 'assistant-text';
    else if (arg === '--events') outputMode = 'events';
    else if (arg === '--raw') outputMode = 'raw';
    else if (arg === '--follow') follow = true;
    else remaining.push(arg);
  }
  return { outputMode, follow, remaining };
}

function parseStartSendArgs(action: 'start' | 'send', argv: string[]): StartSendParsed {
  const { outputMode, remaining } = parseOutputMode(argv);
  let harness: HarnessId | undefined;
  let model: string | undefined;
  let effort: string | undefined;
  let passthroughArgs: string[] = [];
  const promptParts: string[] = [];

  for (let i = 0; i < remaining.length; i++) {
    const arg = remaining[i];
    if (arg === '--') {
      passthroughArgs = remaining.slice(i + 1);
      break;
    }
    if (arg === '--harness') {
      const value = remaining[++i];
      if (!value || !(value in HARNESSES)) throw new Error('Missing or invalid value for --harness');
      harness = value as HarnessId;
      continue;
    }
    if (arg === '--model') {
      model = remaining[++i];
      if (!model) throw new Error('Missing value for --model');
      continue;
    }
    if (arg === '--effort') {
      effort = remaining[++i];
      if (!effort) throw new Error('Missing value for --effort');
      continue;
    }
    if (arg === '--help' || arg === '-h') throw new Error(agentHelp());
    if (arg.startsWith('-')) throw new Error(`Unknown flag: ${arg}. Use -- to pass flags through to the native harness.`);
    promptParts.push(arg);
  }

  return { action, prompt: promptParts.join(' ').trim(), harness, model, effort, passthroughArgs, outputMode };
}

function parseOutputArgs(argv: string[]): OutputParsed {
  const { outputMode, follow, remaining } = parseOutputMode(argv);
  return { outputMode, follow, id: remaining.find((arg) => !arg.startsWith('-')) };
}

function classifyStatus(exitCode: number, stdout: string, stderr: string): 'completed' | 'failed' | 'blocked' {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  if (exitCode === 0) return 'completed';
  if (text.includes('auth') || text.includes('api key') || text.includes('permission') || text.includes('may not exist')) return 'blocked';
  return 'failed';
}

function resolveRunAndHarness(parsed: StartSendParsed, executor: Executor, cwd: string, options: RunAgentOptions): { run: RunRecord; harness: HarnessAdapter } {
  const settings = options.settings ?? loadSettings(cwd);
  const plugin = settings.plugins?.['coding-agents'];
  const requestedHarnessId = parsed.harness ?? plugin?.harness;
  let model = parsed.model ?? plugin?.model;
  let effort = parsed.effort ?? plugin?.effort;
  let run: RunRecord;
  let harness: HarnessAdapter;

  if (parsed.action === 'start') {
    harness = detectHarness(executor, requestedHarnessId);
    if (effort && harness.effortFlags.length === 0) throw new Error(`Harness "${harness.id}" does not support --effort.`);
    run = createRun(cwd, harness, model, effort);
  } else {
    const active = activeRunIdForCwd(cwd);
    if (active) {
      run = loadRun(active);
      if (parsed.harness && parsed.harness !== run.harness) throw new Error(`Active run uses harness ${run.harness}; start a new run for ${parsed.harness}.`);
      harness = detectHarness(executor, run.harness);
      model = parsed.model ?? run.model ?? plugin?.model ?? undefined;
      effort = parsed.effort ?? run.effort ?? plugin?.effort ?? undefined;
      if (effort && harness.effortFlags.length === 0) throw new Error(`Harness "${harness.id}" does not support --effort.`);
      run.model = model ?? run.model;
      run.effort = effort ?? run.effort;
    } else {
      harness = detectHarness(executor, requestedHarnessId);
      if (effort && harness.effortFlags.length === 0) throw new Error(`Harness "${harness.id}" does not support --effort.`);
      run = createRun(cwd, harness, model, effort);
    }
  }

  run.status = 'running';
  run.model = model ?? run.model;
  run.effort = effort ?? run.effort;
  run.lastTurn += 1;
  saveRun(run);
  saveActiveRun(cwd, run.id);
  return { run, harness };
}

function executeTurn(parsed: StartSendParsed, options: RunAgentOptions): number {
  const executor = options.executor ?? defaultExecutor;
  const writer = options.writer ?? process.stdout;
  const errorWriter = options.errorWriter ?? process.stderr;
  const cwd = options.cwd ?? process.cwd();

  const zmxCheck = executor('zmx', ['--help']);
  if (zmxCheck.error || zmxCheck.status !== 0) {
    errorWriter.write('zmx not found. Install zmx to use coding agents.\n');
    return 2;
  }

  const { run, harness } = resolveRunAndHarness(parsed, executor, cwd, options);
  const { shell, stdoutPath, stderrPath, exitCodePath } = buildShellCommand(harness, run, run.lastTurn, parsed.prompt, parsed.passthroughArgs);
  const launch = executor('zmx', ['run', run.sessions.zmx, 'sh', '-lc', shell], 'ignore');
  if (launch.error || launch.status !== 0) {
    run.status = 'failed';
    saveRun(run);
    errorWriter.write(`Failed to queue turn in zmx session ${run.sessions.zmx}.\n`);
    return 3;
  }

  waitForFile(exitCodePath);
  const exitCode = Number(readFileSync(exitCodePath, 'utf-8').trim() || '1');
  const stdout = existsSync(stdoutPath) ? readFileSync(stdoutPath, 'utf-8') : '';
  const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, 'utf-8') : '';
  const normalized = normalizeTurn(run.harness, run.id, run.lastTurn, stdout, stderr, new Date().toISOString());
  const turnStatus = classifyStatus(exitCode, stdout, stderr);
  const turn: TurnRecord = {
    id: run.id,
    turn: run.lastTurn,
    status: turnStatus,
    prompt: parsed.prompt,
    harness: run.harness,
    sessions: {
      zmx: run.sessions.zmx,
      ...(normalized.sessionId || run.sessions[run.harness] ? { [run.harness]: (normalized.sessionId ?? run.sessions[run.harness]) as string } : {}),
    },
    assistant: { text: normalized.assistantText },
    usage: normalized.usage,
    timing: normalized.timing,
    paths: {
      stdout: stdoutPath,
      stderr: stderrPath,
      events: resolve(turnDir(run.id, run.lastTurn), 'events.jsonl'),
    },
    completedAt: new Date().toISOString(),
  };

  writeEvents(turn.paths.events, normalized.events);
  writeJson(resolve(turnDir(run.id, run.lastTurn), 'normalized.json'), turn);
  if (turn.sessions[run.harness]) run.sessions[run.harness] = turn.sessions[run.harness];
  run.status = turnStatus;
  saveRun(run);
  writer.write(`${renderTurn(turn, parsed.outputMode)}\n`);
  return turnStatus === 'completed' ? 0 : 1;
}

function attachToTarget(argv: string[], options: RunAgentOptions): number {
  const executor = options.executor ?? defaultExecutor;
  const errorWriter = options.errorWriter ?? process.stderr;
  if (argv.length < 2) {
    errorWriter.write(`${attachHelp()}\n`);
    return 1;
  }
  const session = argv[0] === 'run' ? loadRun(argv[1]).sessions.zmx : argv[0] === 'session' ? argv[1] : null;
  if (!session) {
    errorWriter.write(`${attachHelp()}\n`);
    return 1;
  }
  return executor('zmx', ['attach', session], 'inherit').status ?? 1;
}

function outputCommand(argv: string[], options: RunAgentOptions): number {
  const writer = options.writer ?? process.stdout;
  const cwd = options.cwd ?? process.cwd();
  const parsed = parseOutputArgs(argv);
  const run = loadRun(resolveRunId(cwd, parsed.id));
  if (parsed.follow && run.status === 'running') {
    followOutput(run, run.lastTurn, parsed.outputMode, writer);
    return 0;
  }
  writer.write(`${renderTurn(latestTurn(run), parsed.outputMode)}\n`);
  return 0;
}

function statusCommand(argv: string[], options: RunAgentOptions): number {
  const writer = options.writer ?? process.stdout;
  const cwd = options.cwd ?? process.cwd();
  writer.write(`${renderStatus(loadRun(resolveRunId(cwd, argv.find((arg) => !arg.startsWith('-')))))}\n`);
  return 0;
}

function listCommand(options: RunAgentOptions): number {
  const writer = options.writer ?? process.stdout;
  writer.write(`${JSON.stringify(listRuns(), null, 2)}\n`);
  return 0;
}

export async function runAgentCommand(argv: string[], options: RunAgentOptions = {}): Promise<number> {
  ensureDirs();
  const writer = options.writer ?? process.stdout;
  const errorWriter = options.errorWriter ?? process.stderr;
  if (!argv.length) {
    writer.write(`${agentHelp()}\n`);
    return 0;
  }
  try {
    const [cmd, ...rest] = argv;
    if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
      writer.write(`${agentHelp()}\n`);
      return 0;
    }
    if (cmd === 'start') return executeTurn(parseStartSendArgs('start', rest), options);
    if (cmd === 'send') return executeTurn(parseStartSendArgs('send', rest), options);
    if (cmd === 'attach') return attachToTarget(rest, options);
    if (cmd === 'output') return outputCommand(rest, options);
    if (cmd === 'status') return statusCommand(rest, options);
    if (cmd === 'list') return listCommand(options);
    return executeTurn(parseStartSendArgs('send', argv), options);
  } catch (error: any) {
    errorWriter.write(`${error.message || error}\n`);
    return 1;
  }
}
