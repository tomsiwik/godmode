import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { CodingAgentsSettings, HarnessAdapter, RunRecord, TurnRecord } from './types.js';

export const GODMODE_HOME = process.platform === 'linux' && process.env.XDG_CONFIG_HOME
  ? resolve(process.env.XDG_CONFIG_HOME, 'godmode')
  : resolve(homedir(), '.godmode');
const CODING_AGENTS_HOME = resolve(GODMODE_HOME, 'coding-agents');
const RUNS_DIR = resolve(CODING_AGENTS_HOME, 'runs');
const ACTIVE_RUNS_PATH = resolve(CODING_AGENTS_HOME, 'active-runs.json');

export function timestamp() {
  return new Date().toISOString();
}

export function ensureDirs() {
  mkdirSync(RUNS_DIR, { recursive: true });
}

export function shellEscape(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

export function writeJson(path: string, value: unknown) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function readSettingsFile(path: string): CodingAgentsSettings {
  return readJson<CodingAgentsSettings>(path) ?? {};
}

export function loadSettings(cwd = process.cwd()): CodingAgentsSettings {
  const globalSettings = readSettingsFile(resolve(GODMODE_HOME, 'settings.json'));
  const projectSettings = readSettingsFile(resolve(cwd, '.godmode', 'settings.json'));
  return {
    ...globalSettings,
    ...projectSettings,
    plugins: {
      ...(globalSettings.plugins ?? {}),
      ...(projectSettings.plugins ?? {}),
      'coding-agents': {
        ...(globalSettings.plugins?.['coding-agents'] ?? {}),
        ...(projectSettings.plugins?.['coding-agents'] ?? {}),
      },
    },
  };
}

function loadActiveRuns(): Record<string, string> {
  return readJson<Record<string, string>>(ACTIVE_RUNS_PATH) ?? {};
}

export function saveActiveRun(cwd: string, id: string) {
  const current = loadActiveRuns();
  current[cwd] = id;
  writeJson(ACTIVE_RUNS_PATH, current);
}

export function activeRunIdForCwd(cwd: string) {
  return loadActiveRuns()[cwd] ?? null;
}

export function runDir(id: string) {
  return resolve(RUNS_DIR, id);
}

export function runPath(id: string) {
  return resolve(runDir(id), 'run.json');
}

export function turnDir(id: string, turn: number) {
  return resolve(runDir(id), 'turns', String(turn).padStart(4, '0'));
}

export function loadRun(id: string): RunRecord {
  const run = readJson<RunRecord>(runPath(id));
  if (!run) throw new Error(`Run not found: ${id}`);
  return run;
}

export function saveRun(run: RunRecord) {
  run.updatedAt = timestamp();
  writeJson(runPath(run.id), run);
}

export function listRuns(): RunRecord[] {
  ensureDirs();
  return readdirSync(RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readJson<RunRecord>(runPath(entry.name)))
    .filter((value): value is RunRecord => !!value)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createRun(cwd: string, harness: HarnessAdapter, model?: string, effort?: string): RunRecord {
  ensureDirs();
  const id = `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const run: RunRecord = {
    id,
    cwd,
    harness: harness.id,
    harnessName: harness.displayName,
    sessions: {
      zmx: `godmode-agent-${harness.id}-${id.replace(/^run-/, '')}`,
    },
    model: model ?? null,
    effort: effort ?? null,
    status: 'idle',
    createdAt: timestamp(),
    updatedAt: timestamp(),
    lastTurn: 0,
  };
  mkdirSync(runDir(id), { recursive: true });
  mkdirSync(resolve(runDir(id), 'turns'), { recursive: true });
  saveRun(run);
  saveActiveRun(cwd, id);
  return run;
}

export function buildShellCommand(harness: HarnessAdapter, run: RunRecord, turn: number, prompt: string, passthroughArgs: string[]) {
  const dir = turnDir(run.id, turn);
  mkdirSync(dir, { recursive: true });
  const stdoutPath = resolve(dir, 'stdout.log');
  const stderrPath = resolve(dir, 'stderr.log');
  const exitCodePath = resolve(dir, 'exit-code.txt');
  const sessionDir = resolve(runDir(run.id), 'pi-session');
  mkdirSync(sessionDir, { recursive: true });
  const args = harness.buildTurnArgs({
    prompt,
    model: run.model ?? undefined,
    effort: run.effort ?? undefined,
    passthroughArgs,
    resumeToken: run.sessions[run.harness] ?? undefined,
    sessionDir,
  });
  const command = `${[harness.command, ...args].map(shellEscape).join(' ')} > ${shellEscape(stdoutPath)} 2> ${shellEscape(stderrPath)}`;
  const shell = `${command}; code=$?; printf '%s' "$code" > ${shellEscape(exitCodePath)}; exit "$code"`;
  return { shell, stdoutPath, stderrPath, exitCodePath };
}

export function waitForFile(path: string, timeoutMs = 300_000) {
  const started = Date.now();
  while (!existsSync(path)) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${path}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
}

export function latestTurn(run: RunRecord): TurnRecord {
  if (run.lastTurn < 1) throw new Error(`Run ${run.id} has no turns yet.`);
  const turn = readJson<TurnRecord>(resolve(turnDir(run.id, run.lastTurn), 'normalized.json'));
  if (!turn) throw new Error(`Turn ${run.lastTurn} not found for ${run.id}`);
  return turn;
}

export function resolveRunId(cwd: string, explicit?: string) {
  if (explicit) return explicit;
  const active = activeRunIdForCwd(cwd);
  if (!active) throw new Error(`No active coding-agent run for ${cwd}`);
  return active;
}
