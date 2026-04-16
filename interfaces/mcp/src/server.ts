import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fuzzysort from 'fuzzysort';
import type { Manifest, Route } from 'godmode/spec';
import { executeToString } from '@godmode-cli/interface-api/request';
import { executeMcpTool } from './index.js';

export interface McpServerOptions {
  filter?: string;
  method?: string;
}

// ── tool naming ─────────────────────────────────────────────

function routeToToolName(route: Route, type: string): string {
  if (type === 'mcp' || type === 'graphql') return route.path;
  // REST: method_segment1_segment2 (params excluded)
  const segments = route.segments.filter(s => !s.isParam).map(s => s.value);
  return `${route.method}_${segments.join('_')}`;
}

// Resource name for filtering (first static segment)
function routeResource(route: Route): string {
  return route.segments.find(s => !s.isParam)?.value || route.path;
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

export async function serveMcp(manifest: Manifest, options: McpServerOptions = {}) {
  const type = manifest.config.type;

  // Filter routes
  let routes = manifest.routes;

  if (options.method) {
    const m = fuzzysort.go(options.method, ['get', 'post', 'put', 'patch', 'delete'])[0]?.target;
    if (m) routes = routes.filter(r => r.method === m);
  }

  if (options.filter) {
    const resources = [...new Set(routes.map(r => routeResource(r)))];
    const matched = new Set(fuzzysort.go(options.filter, resources).map(r => r.target));
    routes = routes.filter(r => matched.has(routeResource(r)));
  }

  const totalRoutes = manifest.routes.length;
  const exposedRoutes = routes.length;
  const filtered = totalRoutes !== exposedRoutes;

  // Build instructions hint
  const hints = [];
  if (filtered) {
    hints.push(`Exposing ${exposedRoutes} of ${totalRoutes} routes.`);
  } else if (totalRoutes > 50) {
    hints.push(`${totalRoutes} routes exposed. Use --filter or --method with "godmode mcp ${manifest.name}" to narrow down.`);
  }

  const server = new Server(
    { name: manifest.name, version: manifest.specVersion || '0.0.1' },
    {
      capabilities: { tools: {} },
      ...(hints.length ? { instructions: hints.join(' ') } : {}),
    },
  );

  // Build tool definitions from routes
  const toolMap = new Map<string, { name: string; description: string; inputSchema: any; route: Route }>();
  for (const route of routes) {
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

  if (filtered) {
    process.stderr.write(`MCP server: ${manifest.name} - ${toolMap.size} tools (filtered from ${totalRoutes})\n`);
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
