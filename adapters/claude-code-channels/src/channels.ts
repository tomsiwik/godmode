import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Cron } from 'croner';
import { watch } from 'node:fs';
import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

// ── types ───────────────────────────────────────────────────

// Minimal type imports to avoid depending on @godmode-cli/cli
interface ApiConfig {
  slug?: string;
  name?: string;
  description?: string;
  type: string;
  url?: string;
  [key: string]: any;
}

interface Segment { value: string; isParam: boolean }
interface Route { path: string; method: string; summary: string; version: string; tag?: string; segments: Segment[] }
interface Manifest {
  name: string; description: string; specVersion: string;
  config: ApiConfig; versions: any[]; resourceDescriptions: Record<string, string>; routes: Route[];
}

type Msg = { from: string; text: string; ts: number };
type ScheduledJob = { id: string; to: string; text: string; cron: string; job: Cron };

// ── constants ───────────────────────────────────────────────

const HOME = homedir();
const SESSIONS_DIR = join(HOME, '.claude', 'sessions');
const MAILBOX_ROOT = join(HOME, '.claude', 'channels', 'ccchat');

const jobs: ScheduledJob[] = [];

// ── session discovery ───────────────────────────────────────

async function findSessionId(): Promise<string> {
  const ppid = process.ppid;
  const directPath = join(SESSIONS_DIR, `${ppid}.json`);
  try {
    const data = JSON.parse(await readFile(directPath, 'utf-8'));
    return data.sessionId;
  } catch {}

  for (const f of await readdir(SESSIONS_DIR).catch(() => [] as string[])) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await readFile(join(SESSIONS_DIR, f), 'utf-8'));
      if (data.pid === ppid) return data.sessionId;
    } catch {}
  }
  return randomUUID();
}

let _sessionId: string | undefined;
async function getSessionId(): Promise<string> {
  if (!_sessionId) _sessionId = await findSessionId();
  return _sessionId;
}

// ── peer management ─────────────────────────────────────────

async function getPeers(sessionId: string): Promise<string[]> {
  const entries = await readdir(MAILBOX_ROOT).catch(() => [] as string[]);
  return entries.filter(e => e !== sessionId && !e.startsWith('.'));
}

async function resolveTarget(sessionId: string, to_session?: string): Promise<string | null> {
  if (to_session) return to_session;
  const peers = await getPeers(sessionId);
  return peers.length === 1 ? peers[0] : null;
}

// ── message delivery ────────────────────────────────────────

async function deliver(target: string, msg: Msg) {
  const targetInbox = join(MAILBOX_ROOT, target);
  await mkdir(targetInbox, { recursive: true });
  await writeFile(join(targetInbox, `${Date.now()}-${msg.from}.json`), JSON.stringify(msg));
}

async function broadcastMsg(sessionId: string, msg: Msg): Promise<number> {
  const peers = await getPeers(sessionId);
  await Promise.all(peers.map(p => deliver(p, msg)));
  return peers.length;
}

// ── cron helpers ────────────────────────────────────────────

function delayToCron(delay: string): string | null {
  const m = delay.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!m) return null;
  const n = parseInt(m[1]);
  switch (m[2]) {
    case 's': return `*/${n} * * * * *`;
    case 'm': return `0 */${n} * * * *`;
    case 'h': return `0 0 */${n} * * *`;
    case 'd': return `0 0 0 */${n} * *`;
  }
  return null;
}

// ── tool definitions ────────────────────────────────────────

const CHANNEL_TOOLS = [
  {
    name: 'send',
    description: 'Send a message to another Claude Code session',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The message to send' },
        to_session: { type: 'string', description: 'Target session ID (optional if one peer)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'broadcast',
    description: 'Send a message to all connected sessions',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The message to send to all peers' },
      },
      required: ['text'],
    },
  },
  {
    name: 'schedule',
    description: 'Schedule a recurring message. Use interval (30s, 5m, 2h) or cron expression.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The message to send' },
        every: { type: 'string', description: 'Interval shorthand: 30s, 5m, 2h, 1d' },
        cron: { type: 'string', description: 'Cron expression (6-field with seconds)' },
        to_session: { type: 'string', description: "Target session ID, 'all' for broadcast" },
      },
      required: ['text'],
    },
  },
  {
    name: 'cancel',
    description: "Cancel a scheduled job by ID, or 'all' to cancel everything",
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: "Job ID from list_jobs, or 'all'" },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_peers',
    description: 'List other active ccchat sessions',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_jobs',
    description: 'List active scheduled jobs',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];

// ── shared tool executor ────────────────────────────────────

async function handleTool(toolName: string, args: Record<string, string>): Promise<string> {
  const sessionId = await getSessionId();

  switch (toolName) {
    case 'list_peers': {
      const peers = await getPeers(sessionId);
      return peers.length ? peers.join('\n') : 'No peers found.';
    }
    case 'list_jobs': {
      const active = jobs.filter(j => j.job.isRunning());
      if (!active.length) return 'No active jobs.';
      return active.map(j => {
        const next = j.job.nextRun()?.toLocaleTimeString() ?? '\u2014';
        return `[${j.id}] ${j.cron} -> ${j.to}: "${j.text.slice(0, 40)}" next: ${next}`;
      }).join('\n');
    }
    case 'cancel': {
      const { id } = args;
      if (id === 'all') {
        jobs.forEach(j => j.job.stop());
        const count = jobs.length;
        jobs.length = 0;
        return `Cancelled ${count} job(s).`;
      }
      const idx = jobs.findIndex(j => j.id === id);
      if (idx === -1) return `Job ${id} not found.`;
      jobs[idx].job.stop();
      jobs.splice(idx, 1);
      return `Cancelled ${id}.`;
    }
    case 'broadcast': {
      const count = await broadcastMsg(sessionId, { from: sessionId, text: args.text, ts: Date.now() });
      return count ? `Broadcast to ${count} peer(s).` : 'No peers found.';
    }
    case 'send': {
      const target = await resolveTarget(sessionId, args.to_session);
      if (!target) {
        const peers = await getPeers(sessionId);
        return peers.length ? `Multiple peers. Specify to_session: ${peers.join(', ')}` : 'No peers found.';
      }
      await deliver(target, { from: sessionId, text: args.text, ts: Date.now() });
      return `Sent to ${target}.`;
    }
    case 'schedule': {
      const target = await resolveTarget(sessionId, args.to_session);
      if (!target) {
        const peers = await getPeers(sessionId);
        return peers.length ? `Multiple peers. Specify to_session: ${peers.join(', ')}` : 'No peers found.';
      }
      const cronExpr = args.cron ?? (args.every ? delayToCron(args.every) : null);
      if (!cronExpr) return "Provide 'every' (30s, 5m, 2h, 1d) or 'cron' expression.";
      const id = randomUUID().slice(0, 8);
      const job = new Cron(cronExpr, async () => {
        const msg = { from: sessionId, text: args.text, ts: Date.now() };
        if (target === 'all') await broadcastMsg(sessionId, msg);
        else await deliver(target, msg);
      });
      jobs.push({ id, to: target, text: args.text, cron: cronExpr, job });
      const next = job.nextRun()?.toLocaleTimeString() ?? 'now';
      return `Job ${id} scheduled (${cronExpr}). Next: ${next}. Use cancel("${id}") to stop.`;
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ── parseChannels (for godmode add) ─────────────────────────

export async function parseChannels(_name: string, config: ApiConfig): Promise<Manifest> {
  const routes: Route[] = CHANNEL_TOOLS.map(tool => ({
    path: tool.name,
    method: 'post',
    summary: tool.description,
    version: '',
    segments: [{ value: tool.name, isParam: false }],
  }));

  const resourceDescriptions: Record<string, string> = {};
  for (const tool of CHANNEL_TOOLS) {
    resourceDescriptions[tool.name] = tool.description;
  }

  return {
    name: _name,
    description: config.description || 'Claude Code inter-session channels',
    specVersion: '',
    config: { ...config, _mcpTools: CHANNEL_TOOLS } as any,
    versions: [],
    resourceDescriptions,
    routes,
  };
}

// ── executeChannelTool (for CLI mode) ───────────────────────

export async function executeChannelTool(
  toolName: string,
  args: Record<string, string>,
  options: { verbose?: boolean; dryRun?: boolean },
): Promise<string> {
  if (options.dryRun || options.verbose) {
    process.stderr.write(`CALL channels \u2192 ${toolName}\n`);
    if (Object.keys(args).length) process.stderr.write(`  Args: ${JSON.stringify(args)}\n`);
    if (options.dryRun) return '';
  }
  return handleTool(toolName, args);
}

// ── serveChannelsMcp (for godmode mcp claude-code-channels) ─

export async function serveChannelsMcp() {
  const sessionId = await getSessionId();
  const myInbox = join(MAILBOX_ROOT, sessionId);
  await mkdir(myInbox, { recursive: true });

  const server = new Server(
    { name: 'ccchat', version: '0.0.1' },
    {
      capabilities: {
        experimental: { 'claude/channel': {} },
        tools: {},
      },
      instructions: [
        `You are in a two-way chat with another Claude Code instance.`,
        `Your session: "${sessionId}".`,
        `Inbound messages arrive as <channel source="ccchat" from_session="...">.`,
        `Tools: "send", "broadcast", "schedule", "cancel", "list_peers", "list_jobs".`,
        `If there's only one peer, "send" targets it automatically.`,
      ].join('\n'),
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: CHANNEL_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const result = await handleTool(req.params.name, (req.params.arguments || {}) as Record<string, string>);
    return { content: [{ type: 'text' as const, text: result }] };
  });

  await server.connect(new StdioServerTransport());

  // Watch inbox for incoming messages
  watch(myInbox, async (_event, filename) => {
    if (!filename?.endsWith('.json')) return;
    const msgPath = join(myInbox, filename);
    try {
      const text = await readFile(msgPath, 'utf-8');
      const msg = JSON.parse(text) as Msg;
      await server.notification({
        method: 'notifications/claude/channel',
        params: { content: msg.text, meta: { from_session: msg.from } },
      });
      await unlink(msgPath).catch(() => {});
    } catch {}
  });
}
