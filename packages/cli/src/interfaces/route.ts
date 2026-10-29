import { matchRoute, suggestRoutes } from '@godmode-cli/interface-api/match';
import { execute } from '@godmode-cli/interface-api/request';
import { readStdin } from '../args.js';
import { EXIT_CODES } from '../exit-codes.js';
import {
  checkPermission,
  resourceFromRawPath,
  resourceFromSegments,
  suggestedAllowRule,
} from '../permissions.js';
import type { Route } from '../spec.js';
import type { InterfaceContext } from './base.js';

export async function executeRoute(ctx: InterfaceContext): Promise<void> {
  const { manifest, extensionName, iface, parsed } = ctx;
  const query = parsed.query;
  const hasBody = Object.keys(parsed.body).length > 0;
  let body: string | undefined = hasBody ? JSON.stringify(parsed.body) : undefined;

  if (!body && ['post', 'put', 'patch'].includes(parsed.method)) body = await readStdin();

  if (parsed.segments[0]?.startsWith('/')) {
    const rawPath = parsed.segments[0];
    const route = manifest.routes.find((r) => r.method === parsed.method && r.path === rawPath);
    const resource = route ? resourceFromSegments(route.segments) : resourceFromRawPath(rawPath);
    const check = checkPermission({ extension: extensionName, resource, method: parsed.method });
    if (!check.allowed) {
      process.stderr.write(`Blocked: ${check.reason}\n`);
      process.stderr.write(`Suggested allow rule:\n${suggestedAllowRule({ extension: extensionName, resource, method: parsed.method })}\n`);
      process.exit(EXIT_CODES.permissionDenied);
    }
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
    process.exit(EXIT_CODES.notFound);
  }

  const resource = resourceFromSegments(match.route.segments);
  const check = checkPermission({ extension: extensionName, resource, method: parsed.method });
  if (!check.allowed) {
    process.stderr.write(`Blocked: ${check.reason}\n`);
    process.stderr.write(`Suggested allow rule:\n${suggestedAllowRule({ extension: extensionName, resource, method: parsed.method })}\n`);
    process.exit(EXIT_CODES.permissionDenied);
  }

  await execute(manifest, match, {
    headers: parsed.headers, query, body,
    debug: parsed.debug, dryRun: parsed.dryRun,
  });
}

function reportNoMatch(ctx: InterfaceContext): void {
  const { manifest, extensionName, iface, parsed } = ctx;
  const httpVerbs = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);
  const trailingVerb = parsed.segments.map((s) => s.toUpperCase()).find((s) => httpVerbs.has(s));
  if (trailingVerb) {
    const rest = parsed.segments.filter((s) => s.toUpperCase() !== trailingVerb);
    process.stderr.write(`No route matching: ${parsed.segments.join(' ')}\n`);
    process.stderr.write(`Method goes first: try 'godmode ${extensionName} ${iface} ${trailingVerb} ${rest.join(' ')}'\n`);
    return;
  }

  process.stderr.write(`No ${parsed.method.toUpperCase()} route matching: ${parsed.segments.join(' ')}\n`);
  for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
    if (method === parsed.method) continue;
    if (matchRoute(manifest, parsed.segments, method)) {
      process.stderr.write(`  try: godmode ${extensionName} api ${method.toUpperCase()} ${parsed.segments.join(' ')}\n`);
    }
  }

  const similar = suggestRoutes(manifest, parsed.segments).slice(0, 5);
  if (!similar.length) return;
  process.stderr.write('\nSimilar:\n');
  const seen = new Set<string>();
  for (const route of similar) {
    const path = route.segments.map((s) => (s.isParam ? `{${s.value}}` : s.value)).join(' ');
    if (seen.has(path)) continue;
    seen.add(path);
    process.stderr.write(`  ${path}\n`);
  }
}
