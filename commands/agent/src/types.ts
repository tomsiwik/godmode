export type HarnessId = 'claude' | 'codex' | 'gemini' | 'pi';
export type RunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'blocked';
export type OutputMode = 'json' | 'assistant-text' | 'events' | 'raw';

export interface CodingAgentsSettings {
  plugins?: {
    'coding-agents'?: {
      harness?: HarnessId;
      model?: string;
      effort?: string;
    };
  };
}

export interface ExecResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export type Executor = (command: string, args: string[], stdio?: 'pipe' | 'inherit' | 'ignore') => ExecResult;

export interface HarnessAdapter {
  id: HarnessId;
  displayName: string;
  command: string;
  modelFlags: string[];
  effortFlags: string[];
  helpArgs: string[];
  promptHints: string[];
  buildTurnArgs(input: {
    prompt: string;
    model?: string;
    effort?: string;
    passthroughArgs: string[];
    resumeToken?: string;
    sessionDir?: string;
  }): string[];
}

export type SessionMap = {
  zmx: string;
} & Partial<Record<HarnessId, string>>;

export interface RunRecord {
  id: string;
  cwd: string;
  harness: HarnessId;
  harnessName: string;
  sessions: SessionMap;
  model: string | null;
  effort: string | null;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  lastTurn: number;
}

export interface TurnRecord {
  id: string;
  turn: number;
  status: 'completed' | 'failed' | 'blocked';
  prompt: string;
  harness: HarnessId;
  sessions: SessionMap;
  assistant: {
    text: string;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    totalTokens?: number;
  };
  timing?: {
    durationMs?: number;
  };
  paths: {
    stdout: string;
    stderr: string;
    events: string;
  };
  completedAt: string;
}

export interface NormalizedEvent {
  ts: string;
  id: string;
  turn: number;
  type: 'turn.started' | 'state.changed' | 'assistant.delta' | 'assistant.completed' | 'turn.completed' | 'warning';
  state?: 'starting' | 'running' | 'thinking' | 'completed' | 'failed' | 'blocked';
  text?: string;
  status?: 'completed' | 'failed' | 'blocked';
  message?: string;
}

export interface StartSendParsed {
  action: 'start' | 'send';
  prompt: string;
  harness?: HarnessId;
  model?: string;
  effort?: string;
  passthroughArgs: string[];
  outputMode: OutputMode;
}

export interface OutputParsed {
  id?: string;
  outputMode: OutputMode;
  follow: boolean;
}

export interface RunAgentOptions {
  executor?: Executor;
  writer?: Pick<typeof process.stdout, 'write'>;
  errorWriter?: Pick<typeof process.stderr, 'write'>;
  cwd?: string;
  settings?: CodingAgentsSettings;
}
