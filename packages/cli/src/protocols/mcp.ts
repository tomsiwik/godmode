import type { ApiConfig, Manifest, Route } from '../spec.js';

// ── MCP JSON-RPC client ─────────────────────────────────────

let requestId = 0;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, any>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

async function mcpRequest(
  url: string,
  method: string,
  params: Record<string, any>,
  headers: Record<string, string>,
  sessionId?: string,
): Promise<{ result: any; sessionId?: string }> {
  const body: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: ++requestId,
    method,
    params,
  };

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-03-26',
    ...headers,
  };
  if (sessionId) reqHeaders['Mcp-Session-Id'] = sessionId;

  const res = await fetch(url, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP request failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const newSessionId = res.headers.get('Mcp-Session-Id') || sessionId;
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    // Parse SSE stream - extract the JSON-RPC response
    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as JsonRpcResponse;
          if (data.id === body.id) {
            if (data.error) throw new Error(`MCP error: ${data.error.message}`);
            return { result: data.result, sessionId: newSessionId };
          }
        } catch (e: any) {
          if (e.message?.startsWith('MCP error')) throw e;
        }
      }
    }
    throw new Error('No response found in SSE stream');
  }

  const json = await res.json() as JsonRpcResponse;
  if (json.error) throw new Error(`MCP error: ${json.error.message}`);
  return { result: json.result, sessionId: newSessionId };
}

// ── auth helpers ────────────────────────────────────────────

function buildAuthHeaders(config: ApiConfig): Record<string, string> {
  const headers: Record<string, string> = { ...config.headers };
  const token = config.auth?.env ? process.env[config.auth.env] : undefined;
  if (token) {
    const authType = config.auth?.type || 'bearer';
    if (authType === 'bearer') headers['Authorization'] = `Bearer ${token}`;
    else if (authType === 'api-key') headers[config.auth?.header || 'X-API-Key'] = token;
  }
  return headers;
}

// ── parse: discover tools via MCP ───────────────────────────

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export async function parseMcp(name: string, config: ApiConfig): Promise<Manifest> {
  if (!config.url) throw new Error('MCP config needs "url" (MCP endpoint)');

  const headers = buildAuthHeaders(config);
  process.stderr.write(`Connecting to ${config.url}...\n`);

  // Initialize
  const init = await mcpRequest(config.url, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'godmode', version: '0.0.1' },
  }, headers);

  const sessionId = init.sessionId;

  // Send initialized notification
  await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-03-26',
      ...headers,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  // List tools
  process.stderr.write(`Discovering tools...\n`);
  const toolsResult = await mcpRequest(config.url, 'tools/list', {}, headers, sessionId);
  const tools: McpTool[] = toolsResult.result?.tools || [];

  // Build routes from tools
  const routes: Route[] = tools.map((tool) => ({
    path: tool.name,
    method: 'post', // MCP tools are always invocations
    summary: tool.description || '',
    version: '',
    segments: [{ value: tool.name, isParam: false }],
  }));

  routes.sort((a, b) => a.path.localeCompare(b.path));
  process.stderr.write(`Discovered ${routes.length} tools\n`);

  // Store tools schema in manifest for runtime use
  const resourceDescriptions: Record<string, string> = {};
  for (const tool of tools) {
    if (tool.description) resourceDescriptions[tool.name] = tool.description;
  }

  return {
    name,
    description: config.description || init.result?.serverInfo?.name || '',
    specVersion: init.result?.protocolVersion || '',
    config: { ...config, _mcpTools: tools } as any,
    versions: [],
    resourceDescriptions,
    routes,
  };
}

// ── validation ──────────────────────────────────────────────

export function validateMcpFlags(
  method: string,
  query: Record<string, string>,
): string | null {
  if (['put', 'patch', 'delete', 'head'].includes(method)) {
    return `MCP tools are invoked via POST. ${method.toUpperCase()} is not valid.`;
  }
  if (Object.keys(query).length) {
    return 'MCP tools use key=value params (body), not key==value (query).';
  }
  return null;
}

// ── execute: call an MCP tool ───────────────────────────────

export async function executeMcpTool(
  config: ApiConfig,
  toolName: string,
  args: Record<string, string>,
  options: { verbose?: boolean; dryRun?: boolean },
): Promise<string> {
  const headers = buildAuthHeaders(config);

  if (options.dryRun || options.verbose) {
    process.stderr.write(`CALL ${config.url} → ${toolName}\n`);
    if (Object.keys(args).length) {
      process.stderr.write(`  Args: ${JSON.stringify(args)}\n`);
    }
    if (options.dryRun) return '';
  }

  // Initialize session
  const init = await mcpRequest(config.url, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'godmode', version: '0.0.1' },
  }, headers);

  const sessionId = init.sessionId;

  // Send initialized notification
  await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-03-26',
      ...headers,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  // Call tool
  const result = await mcpRequest(config.url, 'tools/call', {
    name: toolName,
    arguments: args,
  }, headers, sessionId);

  // Extract text content from MCP response
  const content = result.result?.content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
  }

  return JSON.stringify(result.result, null, 2);
}
