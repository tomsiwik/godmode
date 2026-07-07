import { loadManifest } from '../config.js';
import { EXIT_CODES } from '../exit-codes.js';
import { explainPermission, resourceFromRawPath, resourceFromSegments, suggestedAllowRule } from '../permissions.js';
import { warnSettingsErrors } from '../settings.js';
import { matchRoute } from '@godmode-cli/interface-api/match';

function showPermissionsHelp() {
  console.log(`Inspect godmode permission policy.

Usage:
  godmode permissions list
  godmode permissions explain <extension> <interface> <target> [method]

Exit codes:
  0   success / allowed
  2   usage or parse error
  3   extension or route not found
  4   permission denied
  10  upstream HTTP 4xx
  11  upstream HTTP 5xx
  12  upstream failure`);
}

export async function runPermissions(rest: string[]) {
  const cmd = rest[0];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    warnSettingsErrors();
    showPermissionsHelp();
    return;
  }

  if (cmd === 'list') {
    const { loadSettingsDetailed } = await import('../settings.js');
    const loaded = loadSettingsDetailed();
    for (const error of loaded.errors) {
      process.stderr.write(`Warning: cannot parse ${error.path}: ${error.message}\n`);
    }
    const sources = loaded.sources.flatMap((source) => {
      const extensions = source.settings.extensions ?? {};
      return Object.entries(extensions).flatMap(([slug, settings]) => {
        const permissions = settings.permissions;
        if (!permissions?.allow?.length && !permissions?.deny?.length) return [];
        return [{ slug, permissions, origin: `${source.scope}:${source.path}` }];
      });
    });
    if (!sources.length) {
      console.log('No permissions configured.');
      return;
    }
    for (const { slug, permissions, origin } of sources) {
      console.log(`${slug}:`);
      for (const effect of ['allow', 'deny'] as const) {
        for (const rule of permissions[effect] ?? []) {
          const resources = rule.resources?.join(', ') || '*';
          const methods = rule.methods?.join(', ') || '*';
          console.log(`  ${effect} resources=[${resources}] methods=[${methods}] origin=${origin}`);
        }
      }
    }
    return;
  }

  if (cmd === 'explain') {
    const [extension, iface, target, maybeMethod] = rest.slice(1);
    if (!extension || !iface || !target) {
      process.stderr.write('Usage: godmode permissions explain <extension> <interface> <target> [method]\n');
      process.exit(EXIT_CODES.usage);
    }
    const method = iface === 'mcp' ? 'mcp' : (maybeMethod || 'GET');
    const resource = await explainResource(extension, iface, target, method);
    const decision = explainPermission({ extension, resource, method });
    console.log(`${decision.allowed ? 'allow' : 'deny'} ${extension} ${iface} ${target} ${method.toUpperCase()}`);
    if (decision.reason) console.log(decision.reason);
    if (decision.rule) {
      console.log(`winning rule: resources=[${decision.rule.resources?.join(', ') || '*'}] methods=[${decision.rule.methods?.join(', ') || '*'}] origin=${decision.origin || 'settings.yaml'}`);
    }
    if (!decision.allowed) {
      console.log(`suggested allow rule:\n${suggestedAllowRule({ extension, resource, method })}`);
      process.exit(EXIT_CODES.permissionDenied);
    }
    return;
  }

  process.stderr.write(`Unknown permissions command '${cmd}'.\n`);
  process.stderr.write(`Try 'godmode permissions --help' for more information.\n`);
  process.exit(EXIT_CODES.usage);
}

async function explainResource(extension: string, iface: string, target: string, method: string): Promise<string> {
  if (iface === 'mcp') return target;
  if (iface === 'api' || iface === 'graphql') {
    try {
      const manifest = await loadManifest(extension, iface);
      const normalizedMethod = method.toLowerCase();
      if (target.startsWith('/')) {
        const exact = manifest.routes.find((route) => route.method === normalizedMethod && route.path === target);
        if (exact) return resourceFromSegments(exact.segments);
      }
      const segments = target
        .replace(/^\/+/, '')
        .split(/[/.]/)
        .filter(Boolean);
      const match = matchRoute(manifest, segments, normalizedMethod);
      if (match) return resourceFromSegments(match.route.segments);
      return resourceFromRawPath(target);
    } catch {
      return target.replace(/^\/+/, '').replace(/\//g, '.').replace(/^v\d+\./i, '') || '*';
    }
  }
  return target.replace(/^\/+/, '').replace(/\//g, '.').replace(/^v\d+\./i, '') || '*';
}
