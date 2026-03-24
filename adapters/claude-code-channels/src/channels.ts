import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Cron } from 'croner';
import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ── constants ───────────────────────────────────────────────

const HOME = homedir();
const SESSIONS_DIR = join(HOME, '.claude', 'sessions');

type Msg = { from: string; text: string; ts: number };
type ScheduledJob = { id: string; to: string; text: string; cron: string; job: Cron };
const jobs: ScheduledJob[] = [];

// ── session discovery ───────────────────────────────────────

function pidFromSession(filename: string): string {
  return filename.replace(/\.(json|sock)$/, '');
}

async function findPid(): Promise<string> {
  const ppid = String(process.ppid);
  const directPath = join(SESSIONS_DIR, `${ppid}.json`);
  const file = Bun.file(directPath);
  if (await file.exists()) return ppid;

  for (const f of await readdir(SESSIONS_DIR).catch(() => [] as string[])) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = await Bun.file(join(SESSIONS_DIR, f)).json();
      if (data.pid === process.ppid) return pidFromSession(f);
    } catch {}
  }

  throw new Error(`Could not find Claude Code session for pid ${ppid}`);
}

// ── socket paths ────────────────────────────────────────────

function socketPath(pid: string): string {
  return join(SESSIONS_DIR, `${pid}.sock`);
}

// ── peer discovery ──────────────────────────────────────────

async function getPeers(myPid: string): Promise<string[]> {
  const entries = await readdir(SESSIONS_DIR).catch(() => [] as string[]);
  return entries
    .filter(e => e.endsWith('.sock') && pidFromSession(e) !== myPid)
    .map(e => pidFromSession(e));
}

async function resolveTarget(myPid: string, to_session?: string): Promise<string | null> {
  if (to_session) return to_session;
  const peers = await getPeers(myPid);
  return peers.length === 1 ? peers[0] : null;
}

// ── message delivery via unix socket ────────────────────────

async function deliver(targetPid: string, msg: Msg): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = Bun.connect({
      unix: socketPath(targetPid),
      socket: {
        open(socket) {
          socket.write(JSON.stringify(msg) + '\n');
          socket.end();
        },
        close() { resolve(); },
        data() {},
        error(_, err) { reject(new Error(`Peer ${targetPid} unreachable: ${err.message}`)); },
      },
    });
  });
}

async function broadcastMsg(myPid: string, msg: Msg): Promise<number> {
  const peers = await getPeers(myPid);
  let sent = 0;
  await Promise.all(peers.map(p =>
    deliver(p, msg).then(() => sent++).catch(() => {})
  ));
  return sent;
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
        to_session: { type: 'string', description: 'Target session PID (optional if one peer)' },
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
        to_session: { type: 'string', description: "Target session PID, 'all' for broadcast" },
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
    description: 'List other active channel sessions',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_jobs',
    description: 'List active scheduled jobs',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];

// ── tool executor ───────────────────────────────────────────

async function handleTool(myPid: string, toolName: string, args: Record<string, string>): Promise<string> {
  switch (toolName) {
    case 'list_peers': {
      const peers = await getPeers(myPid);
      return peers.length ? peers.join('\n') : 'No peers found.';
    }
    case 'list_jobs': {
      const active = jobs.filter(j => j.job.isRunning());
      if (!active.length) return 'No active jobs.';
      return active.map(j => {
        const next = j.job.nextRun()?.toLocaleTimeString() ?? '-';
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
      const msg: Msg = { from: myPid, text: args.text, ts: Date.now() };
      const count = await broadcastMsg(myPid, msg);
      return count ? `Broadcast to ${count} peer(s).` : 'No peers found.';
    }
    case 'send': {
      const target = await resolveTarget(myPid, args.to_session);
      if (!target) {
        const peers = await getPeers(myPid);
        return peers.length ? `Multiple peers. Specify to_session: ${peers.join(', ')}` : 'No peers found.';
      }
      await deliver(target, { from: myPid, text: args.text, ts: Date.now() });
      return `Sent to ${target}.`;
    }
    case 'schedule': {
      const target = await resolveTarget(myPid, args.to_session);
      if (!target) {
        const peers = await getPeers(myPid);
        return peers.length ? `Multiple peers. Specify to_session: ${peers.join(', ')}` : 'No peers found.';
      }
      const cronExpr = args.cron ?? (args.every ? delayToCron(args.every) : null);
      if (!cronExpr) return "Provide 'every' (30s, 5m, 2h, 1d) or 'cron' expression.";
      const id = crypto.randomUUID().slice(0, 8);
      const job = new Cron(cronExpr, async () => {
        const msg: Msg = { from: myPid, text: args.text, ts: Date.now() };
        if (target === 'all') await broadcastMsg(myPid, msg);
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

// ── MCP server ──────────────────────────────────────────────

async function main() {
  const myPid = await findPid();
  const sockPath = socketPath(myPid);

  // Clean up stale socket if it exists
  await unlink(sockPath).catch(() => {});

  // MCP server over stdio
  const mcpServer = new Server(
    { name: 'claude-code-channels', version: '0.0.1' },
    {
      capabilities: {
        experimental: { 'claude/channel': {} },
        tools: {},
      },
      instructions: [
        `You are in a two-way chat with another Claude Code instance.`,
        `Your session PID: "${myPid}".`,
        `Inbound messages arrive as <channel source="claude-code-channels" from_session="...">.`,
        `Tools: "send", "broadcast", "schedule", "cancel", "list_peers", "list_jobs".`,
        `If there's only one peer, "send" targets it automatically.`,
      ].join('\n'),
    },
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: CHANNEL_TOOLS,
  }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (req) => {
    const result = await handleTool(myPid, req.params.name, (req.params.arguments || {}) as Record<string, string>);
    return { content: [{ type: 'text' as const, text: result }] };
  });

  await mcpServer.connect(new StdioServerTransport());

  // Unix socket server for incoming messages from peers
  Bun.listen({
    unix: sockPath,
    socket: {
      open() {},
      data(socket, data) {
        for (const line of data.toString().split('\n').filter(Boolean)) {
          try {
            const msg = JSON.parse(line) as Msg;
            mcpServer.notification({
              method: 'notifications/claude/channel',
              params: { content: msg.text, meta: { from_session: msg.from } },
            });
          } catch {}
        }
      },
    },
  });

  // Cleanup on exit
  process.on('exit', () => { unlink(sockPath).catch(() => {}); });
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

main();
