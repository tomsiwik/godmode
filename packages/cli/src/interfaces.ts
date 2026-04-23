/**
 * Interface dispatch. Each concrete class owns execution for exactly one
 * interface type (`api` / `graphql` / `mcp`). `runInterface` in index.ts
 * becomes a thin factory that instantiates the right one and delegates.
 *
 * Shared behavior (help rendering, the synthetic-route raw-path escape
 * hatch, route-matching error recovery) lives on the base class so
 * subclasses only override the bits that actually differ.
 */

import { matchRoute, suggestRoutes } from '@godmode-cli/interface-api/match';
import { execute } from '@godmode-cli/interface-api/request';
import { validateGraphQLFlags } from '@godmode-cli/interface-graphql';
import { validateMcpFlags, executeMcpTool } from '@godmode-cli/interface-mcp';
import { runMcp } from '@godmode-cli/interface-mcp/command';
import type { ParsedArgs } from './args.js';
import { readStdin } from './args.js';
import { loadManifest, GODMODE_HOME } from './config.js';
import { showApiHelp } from './help.js';
import { checkPermission, resourceFromSegments, resourceFromTool } from './permissions.js';
import type { InterfaceKey, Manifest, MultiManifest, Route } from './spec.js';

interface InterfaceCtx {
  iface: InterfaceKey;
  extensionName: string;
  manifest: Manifest;
  multi: MultiManifest;
  parsed: ParsedArgs;
  /** Original argv tail passed to the interface (used by MCP's stdio serve path). */
  rawRest: string[];
}

export abstract class Interface {
  constructor(protected readonly ctx: InterfaceCtx) {}

  /** `godmode <ext> <iface>` with no resource — by default shows help.
   *  MCP overrides to serve as an MCP server over stdio. */
  async handleEmpty(): Promise<void> {
    this.showHelp();
  }

  /** Interface-specific arg validation. Return an error string to bail, or
   *  null to proceed. Called after segments have been provided. */
  validate(): string | null { return null; }

  /** Execute the request. Called only after `validate()` returns null. */
  abstract execute(): Promise<void>;

  showHelp(): void {
    const { manifest, extensionName, parsed, multi } = this.ctx;
    const implicitMethodFilter =
      parsed.methodFilter || (parsed.explicitMethod ? parsed.method : undefined);
    showApiHelp(manifest, extensionName, parsed.segments, parsed.filter, implicitMethodFilter, parsed.all, multi);
  }
}

/** Shared route-matching execute for API + GraphQL. GraphQL's fields are
 *  compiled into the same route shape at spec time, so both flow through
 *  `matchRoute` + `execute` identically. */
async function executeRoute(ctx: InterfaceCtx): Promise<void> {
  const { manifest, extensionName, iface, parsed } = ctx;
  const query = parsed.query;
  const hasBody = Object.keys(parsed.body).length > 0;
  let body: string | undefined = hasBody ? JSON.stringify(parsed.body) : undefined;

  if (!body && ['post', 'put', 'patch'].includes(parsed.method)) {
    body = await readStdin();
  }

  // Raw-path escape hatch: `godmode stripe api /v1/customers`.
  if (parsed.segments[0]?.startsWith('/')) {
    const rawPath = parsed.segments[0];
    const syntheticRoute: Route = {
      path: rawPath, method: parsed.method, summary: '', version: '', segments: [],
    };
    await execute(manifest, { route: syntheticRoute, params: {} }, {
      headers: parsed.headers, query, body,
      debug: parsed.debug, dryRun: parsed.dryRun,
    });
    return;
  }

  const match = matchRoute(manifest, parsed.segments, parsed.method);
  if (!match) {
    reportNoMatch(ctx);
    process.exit(1);
  }

  const check = checkPermission({
    extension: extensionName,
    resource: resourceFromSegments(match.route.segments),
    method: parsed.method,
  });
  if (!check.allowed) {
    process.stderr.write(`Blocked: ${check.reason}\n`);
    process.exit(1);
  }

  await execute(manifest, match, {
    headers: parsed.headers, query, body,
    debug: parsed.debug, dryRun: parsed.dryRun,
  });
}

function reportNoMatch(ctx: InterfaceCtx): void {
  const { manifest, extensionName, iface, parsed } = ctx;
  const HTTP_VERBS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

  // "resource METHOD" typo → suggest swapping order.
  const trailingVerb = parsed.segments
    .map((s) => s.toUpperCase())
    .find((s) => HTTP_VERBS.has(s));
  if (trailingVerb) {
    const rest = parsed.segments.filter((s) => s.toUpperCase() !== trailingVerb);
    process.stderr.write(`No route matching: ${parsed.segments.join(' ')}\n`);
    process.stderr.write(`Method goes first: try 'godmode ${extensionName} ${iface} ${trailingVerb} ${rest.join(' ')}'\n`);
    return;
  }

  process.stderr.write(`No ${parsed.method.toUpperCase()} route matching: ${parsed.segments.join(' ')}\n`);
  for (const m of ['get', 'post', 'put', 'patch', 'delete'] as const) {
    if (m === parsed.method) continue;
    if (matchRoute(manifest, parsed.segments, m)) {
      process.stderr.write(`  try: godmode ${extensionName} api ${m.toUpperCase()} ${parsed.segments.join(' ')}\n`);
    }
  }

  const similar = suggestRoutes(manifest, parsed.segments).slice(0, 5);
  if (similar.length) {
    process.stderr.write('\nSimilar:\n');
    const seen = new Set<string>();
    for (const r of similar) {
      const p = r.segments.map((s) => (s.isParam ? `{${s.value}}` : s.value)).join(' ');
      if (seen.has(p)) continue;
      seen.add(p);
      process.stderr.write(`  ${p}\n`);
    }
  }
}

export class ApiInterface extends Interface {
  validate(): string | null {
    if (!this.ctx.parsed.explicitMethod) {
      return `Missing HTTP method. Try: godmode ${this.ctx.extensionName} api GET ${this.ctx.parsed.segments.join(' ')}\n`
        + `Valid methods: GET, POST, PUT, PATCH, DELETE, HEAD.`;
    }
    return null;
  }
  execute(): Promise<void> { return executeRoute(this.ctx); }
}

export class GraphqlInterface extends Interface {
  validate(): string | null {
    const { parsed, extensionName } = this.ctx;
    return validateGraphQLFlags(parsed.method, parsed.query, parsed.body, extensionName);
  }
  execute(): Promise<void> { return executeRoute(this.ctx); }
}

export class McpInterface extends Interface {
  async handleEmpty(): Promise<void> {
    // Bare `godmode <ext> mcp` with no tool → serve as an MCP server.
    const { extensionName, rawRest } = this.ctx;
    await runMcp(
      { godmodeHome: GODMODE_HOME, loadManifest: (n) => loadManifest(n, 'mcp') },
      [extensionName, ...rawRest],
    );
  }

  validate(): string | null {
    const { parsed } = this.ctx;
    return validateMcpFlags(parsed.method, parsed.query);
  }

  async execute(): Promise<void> {
    const { manifest, parsed, extensionName } = this.ctx;
    const tool = parsed.segments[0];

    const check = checkPermission({
      extension: extensionName,
      resource: resourceFromTool(tool),
      method: 'mcp',
    });
    if (!check.allowed) {
      process.stderr.write(`Blocked: ${check.reason}\n`);
      process.exit(1);
    }

    const result = await executeMcpTool(manifest.config, tool, parsed.body, {
      debug: parsed.debug, dryRun: parsed.dryRun,
    });
    if (result) process.stdout.write(result + '\n');
  }
}

export function getInterface(ctx: InterfaceCtx): Interface {
  switch (ctx.iface) {
    case 'api':     return new ApiInterface(ctx);
    case 'graphql': return new GraphqlInterface(ctx);
    case 'mcp':     return new McpInterface(ctx);
    default:
      throw new Error(`Unknown interface: ${ctx.iface}`);
  }
}
