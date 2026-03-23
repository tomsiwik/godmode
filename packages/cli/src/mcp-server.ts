import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Manifest, Route } from './spec.js';
import { executeToString } from './request.js';
import { executeMcpTool } from './protocols/mcp.js';

// ── tool naming ─────────────────────────────────────────────

function routeToToolName(route: Route, type: string): string {
  if (type === 'mcp' || type === 'graphql') return route.path;
  // REST: method_segment1_segment2 (params excluded)
  const segments = route.segments.filter(s => !s.isParam).map(s => s.value);
  return `${route.method}_${segments.join('_')}`;
}

// ── input schema generation ─────────────────────────────────

function routeToInputSchema(route: Route, manifest: Manifest) {
  const type = manifest.config.type;

  if (type === 'mcp') {
    const mcpTools = (manifest.config as any)._mcpTools as Array<{ name: string; inputSchema?: any }> | undefined;
    const tool = mcpTools?.find(t => t.name === route.path);
    return tool?.inputSchema || { type: 'object', properties: {} };
  }

  if (type === 'graphql') {
    return { type: 'object', properties: { query: { type: 'string', description: 'GraphQL query document' } }, required: ['query'] };
  }

  // REST: path params + optional body
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (const seg of route.segments) {
    if (seg.isParam) {
      properties[seg.value] = { type: 'string', description: `Path parameter: ${seg.value}` };
      required.push(seg.value);
    }
  }
  if (['post', 'put', 'patch'].includes(route.method)) {
    properties['body'] = { type: 'string', description: 'JSON request body' };
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

// ── serve ───────────────────────────────────────────────────

export async function serveMcp(manifest: Manifest) {
  const type = manifest.config.type;

  const server = new Server(
    { name: manifest.name, version: manifest.specVersion || '0.0.1' },
    { capabilities: { tools: {} } },
  );

  // Build tool definitions from routes
  const toolMap = new Map<string, { name: string; description: string; inputSchema: any; route: Route }>();
  for (const route of manifest.routes) {
    const name = routeToToolName(route, type);
    if (!toolMap.has(name)) {
      toolMap.set(name, {
        name,
        description: route.summary || `${route.method.toUpperCase()} ${route.path}`,
        inputSchema: routeToInputSchema(route, manifest),
        route,
      });
    }
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...toolMap.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const toolName = req.params.name;
    const args = (req.params.arguments || {}) as Record<string, string>;
    const tool = toolMap.get(toolName);

    if (!tool) {
      return { content: [{ type: 'text' as const, text: `Unknown tool: ${toolName}` }], isError: true };
    }

    try {
      let result: string;

      if (type === 'mcp') {
        result = await executeMcpTool(manifest.config, toolName, args, {});
      } else if (type === 'graphql') {
        result = await executeToString(manifest, { route: tool.route, params: {} }, {
          headers: {}, query: {}, body: JSON.stringify({ query: args.query }),
        });
      } else {
        // REST: extract path params from args
        const params: Record<string, string> = {};
        for (const seg of tool.route.segments) {
          if (seg.isParam && args[seg.value]) params[seg.value] = args[seg.value];
        }
        result = await executeToString(manifest, { route: tool.route, params }, {
          headers: {}, query: {}, body: args.body,
        });
      }

      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  await server.connect(new StdioServerTransport());
}
