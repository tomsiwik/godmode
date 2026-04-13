import type { Executor, HarnessAdapter, HarnessId, NormalizedEvent, TurnRecord } from './types.js';

export const DEFAULT_HARNESS_ORDER: HarnessId[] = ['claude', 'codex', 'gemini', 'pi'];

export const HARNESSES: Record<HarnessId, HarnessAdapter> = {
  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    command: 'claude',
    modelFlags: ['--model'],
    effortFlags: ['--effort'],
    helpArgs: ['--help'],
    promptHints: ['[prompt]', 'your prompt'],
    buildTurnArgs: ({ prompt, model, effort, passthroughArgs, resumeToken }) => [
      '-p', '--verbose', '--output-format', 'stream-json',
      ...(resumeToken ? ['--resume', resumeToken] : []),
      ...(model ? ['--model', model] : []),
      ...(effort ? ['--effort', effort] : []),
      prompt,
      ...passthroughArgs,
    ],
  },
  codex: {
    id: 'codex',
    displayName: 'Codex CLI',
    command: 'codex',
    modelFlags: ['-m', '--model'],
    effortFlags: [],
    helpArgs: ['--help'],
    promptHints: ['[prompt]', 'optional user prompt'],
    buildTurnArgs: ({ prompt, model, passthroughArgs }) => [
      'exec', '--json',
      ...(model ? ['-m', model] : []),
      prompt,
      ...passthroughArgs,
    ],
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini CLI',
    command: 'gemini',
    modelFlags: ['-m', '--model'],
    effortFlags: [],
    helpArgs: ['--help'],
    promptHints: ['query', 'initial prompt'],
    buildTurnArgs: ({ prompt, model, passthroughArgs, resumeToken }) => [
      ...(resumeToken ? ['--resume', resumeToken] : []),
      ...(model ? ['-m', model] : []),
      '-p', prompt,
      '-o', 'stream-json',
      ...passthroughArgs,
    ],
  },
  pi: {
    id: 'pi',
    displayName: 'Pi',
    command: 'pi',
    modelFlags: ['--model'],
    effortFlags: ['--thinking'],
    helpArgs: ['--help'],
    promptHints: ['[messages...]', 'initial prompt'],
    buildTurnArgs: ({ prompt, model, effort, passthroughArgs, resumeToken, sessionDir }) => [
      '--print', '--mode', 'json',
      ...(sessionDir ? ['--session-dir', sessionDir] : []),
      ...(resumeToken ? ['--continue'] : []),
      ...(model ? ['--model', model] : []),
      ...(effort ? ['--thinking', effort] : []),
      prompt,
      ...passthroughArgs,
    ],
  },
};

export function detectHarness(executor: Executor, requested?: HarnessId): HarnessAdapter {
  const ids = requested ? [requested] : DEFAULT_HARNESS_ORDER;
  for (const id of ids) {
    const harness = HARNESSES[id];
    const result = executor(harness.command, harness.helpArgs);
    if (!result.error && result.status === 0) return harness;
  }
  throw new Error(requested ? `Harness "${requested}" not found.` : 'No supported coding harness found.');
}

function event(ts: string, id: string, turn: number, partial: Omit<NormalizedEvent, 'ts' | 'id' | 'turn'>): NormalizedEvent {
  return { ts, id, turn, ...partial };
}

export function normalizeTurn(
  harness: HarnessId,
  id: string,
  turn: number,
  stdout: string,
  stderr: string,
  ts: string,
): { sessionId: string | null; assistantText: string; events: NormalizedEvent[]; usage?: TurnRecord['usage']; timing?: TurnRecord['timing'] } {
  const lines = stdout.split(/\r?\n/);
  if (harness === 'claude') return parseClaude(lines, id, turn, stderr, ts);
  if (harness === 'gemini') return parseGemini(lines, id, turn, stderr, ts);
  if (harness === 'pi') return parsePi(lines, id, turn, stderr, ts);
  return {
    sessionId: null,
    assistantText: stdout.trim(),
    events: [
      event(ts, id, turn, { type: 'turn.started' }),
      event(ts, id, turn, { type: 'assistant.completed', text: stdout.trim() }),
      event(ts, id, turn, { type: 'turn.completed', status: 'completed' }),
    ],
  } satisfies { sessionId: string | null; assistantText: string; events: NormalizedEvent[]; usage?: TurnRecord['usage']; timing?: TurnRecord['timing'] };
}

function parseClaude(lines: string[], id: string, turn: number, stderr: string, ts: string) {
  const events: NormalizedEvent[] = [];
  let sessionId: string | null = null;
  let assistantText = '';
  let usage: TurnRecord['usage'] | undefined;
  let timing: TurnRecord['timing'] | undefined;

  for (const line of lines) {
    if (!line.trim()) continue;
    let parsed: any;
    try { parsed = JSON.parse(line); } catch { continue; }
    if (parsed.type === 'system' && parsed.subtype === 'init') {
      sessionId = parsed.session_id ?? sessionId;
      events.push(event(ts, id, turn, { type: 'turn.started' }));
      events.push(event(ts, id, turn, { type: 'state.changed', state: 'starting' }));
    }
    if (parsed.type === 'assistant') {
      const text = (parsed.message?.content ?? []).filter((item: any) => item.type === 'text').map((item: any) => item.text).join('');
      if (text) assistantText = text;
      if (text) events.push(event(ts, id, turn, { type: 'assistant.completed', text }));
    }
    if (parsed.type === 'result') {
      sessionId = parsed.session_id ?? sessionId;
      usage = {
        inputTokens: parsed.usage?.input_tokens,
        outputTokens: parsed.usage?.output_tokens,
        cachedTokens: parsed.usage?.cache_read_input_tokens,
      };
      timing = { durationMs: parsed.duration_ms };
      events.push(event(ts, id, turn, { type: 'turn.completed', status: parsed.is_error ? 'failed' : 'completed' }));
    }
  }
  for (const line of stderr.split(/\r?\n/).filter(Boolean)) events.push(event(ts, id, turn, { type: 'warning', message: line }));
  return { sessionId, assistantText, events, usage, timing };
}

function parseGemini(lines: string[], id: string, turn: number, stderr: string, ts: string) {
  const events: NormalizedEvent[] = [];
  let sessionId: string | null = null;
  let assistantText = '';
  let usage: TurnRecord['usage'] | undefined;
  let timing: TurnRecord['timing'] | undefined;

  for (const line of lines) {
    if (!line.trim()) continue;
    let parsed: any;
    try { parsed = JSON.parse(line); } catch { continue; }
    if (parsed.type === 'init') {
      sessionId = parsed.session_id ?? sessionId;
      events.push(event(ts, id, turn, { type: 'turn.started' }));
      events.push(event(ts, id, turn, { type: 'state.changed', state: 'starting' }));
    }
    if (parsed.type === 'message' && parsed.role === 'assistant' && parsed.delta === true && typeof parsed.content === 'string') {
      assistantText += parsed.content;
      events.push(event(ts, id, turn, { type: 'assistant.delta', text: parsed.content }));
    }
    if (parsed.type === 'result') {
      usage = {
        inputTokens: parsed.stats?.input_tokens,
        outputTokens: parsed.stats?.output_tokens,
        cachedTokens: parsed.stats?.cached,
        totalTokens: parsed.stats?.total_tokens,
      };
      timing = { durationMs: parsed.stats?.duration_ms };
      events.push(event(ts, id, turn, { type: 'assistant.completed', text: assistantText }));
      events.push(event(ts, id, turn, { type: 'turn.completed', status: parsed.status === 'success' ? 'completed' : 'failed' }));
    }
  }
  for (const line of stderr.split(/\r?\n/).filter(Boolean)) events.push(event(ts, id, turn, { type: 'warning', message: line }));
  return { sessionId, assistantText, events, usage, timing };
}

function parsePi(lines: string[], id: string, turn: number, stderr: string, ts: string) {
  const events: NormalizedEvent[] = [];
  let sessionId: string | null = null;
  let assistantText = '';

  for (const line of lines) {
    if (!line.trim()) continue;
    let parsed: any;
    try { parsed = JSON.parse(line); } catch { continue; }
    if (parsed.type === 'session') {
      sessionId = parsed.id ?? sessionId;
      events.push(event(ts, id, turn, { type: 'turn.started' }));
      events.push(event(ts, id, turn, { type: 'state.changed', state: 'starting' }));
    }
    if (parsed.type === 'turn_start') events.push(event(ts, id, turn, { type: 'state.changed', state: 'running' }));
    if (parsed.type === 'message_update' && parsed.assistantMessageEvent?.type === 'thinking_start') {
      events.push(event(ts, id, turn, { type: 'state.changed', state: 'thinking' }));
    }
    if (parsed.type === 'message_update' && parsed.assistantMessageEvent?.type === 'text_delta') {
      const delta = parsed.assistantMessageEvent.delta ?? '';
      assistantText += delta;
      if (delta) events.push(event(ts, id, turn, { type: 'assistant.delta', text: delta }));
    }
    if (parsed.type === 'turn_end') {
      const text = (parsed.message?.content ?? []).filter((item: any) => item.type === 'text').map((item: any) => item.text).join('');
      if (text) assistantText = text;
      events.push(event(ts, id, turn, { type: 'assistant.completed', text: assistantText }));
      events.push(event(ts, id, turn, { type: 'turn.completed', status: 'completed' }));
    }
  }
  for (const line of stderr.split(/\r?\n/).filter(Boolean)) events.push(event(ts, id, turn, { type: 'warning', message: line }));
  return { sessionId, assistantText, events };
}
