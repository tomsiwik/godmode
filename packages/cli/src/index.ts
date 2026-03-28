import { loadEnv } from './env.js';
import { removeApi, updateApi, listApis, loadManifest } from './config.js';
import { matchRoute, suggestRoutes } from './match.js';
import { execute } from './request.js';
import { validateGraphQLFlags } from './protocols/graphql.js';
import { validateMcpFlags, executeMcpTool } from './protocols/mcp.js';
import { parseArgs, readStdin } from './args.js';
import { showHelp, showApiHelp } from './help.js';
import type { Route } from './spec.js';

loadEnv();

async function main() {
  const args = process.argv.slice(2);

  if (!args.length || (args.length === 1 && (args[0] === '-h' || args[0] === '--help'))) {
    showHelp();
    return;
  }

  const cmd = args[0];

  // ── management commands ──

  if (cmd === 'create') {
    const { configWizard } = await import('./prompt.js');
    await configWizard();
    return;
  }

  if (cmd === 'add') {
    const { runAdd } = await import('./commands/add.js');
    await runAdd(args.slice(1));
    return;
  }

  if (cmd === 'update') {
    if (!args[1]) { console.error('Usage: godmode update <name>'); process.exit(1); }
    await updateApi(args[1]);
    return;
  }

  if (cmd === 'remove') {
    if (!args[1]) { console.error('Usage: godmode remove <name>'); process.exit(1); }
    await removeApi(args[1]);
    return;
  }

  if (cmd === 'list') {
    await listApis();
    return;
  }

  if (cmd === 'mcp') {
    const { runMcp } = await import('./commands/mcp.js');
    await runMcp(args.slice(1));
    return;
  }

  // ── API call ──

  const apiName = cmd;
  const parsed = parseArgs(args.slice(1));
  const manifest = await loadManifest(apiName);

  if (parsed.help || !parsed.segments.length) {
    showApiHelp(manifest, apiName, parsed.segments, parsed.filter, parsed.methodFilter, parsed.all);
    return;
  }

  // ── protocol dispatch ──

  if (manifest.config.type === 'graphql') {
    const err = validateGraphQLFlags(parsed.method, parsed.query, parsed.body, apiName);
    if (err) { process.stderr.write(err + '\n'); process.exit(1); }
  }

  if (manifest.config.type === 'mcp') {
    const err = validateMcpFlags(parsed.method, parsed.query);
    if (err) { process.stderr.write(err + '\n'); process.exit(1); }
    const result = await executeMcpTool(manifest.config, parsed.segments[0], parsed.body, {
      verbose: parsed.verbose,
      dryRun: parsed.dryRun,
    });
    if (result) process.stdout.write(result + '\n');
    return;
  }

  // ── REST execution ──

  const query = parsed.query;
  const hasBody = Object.keys(parsed.body).length > 0;
  let body: string | undefined = hasBody ? JSON.stringify(parsed.body) : undefined;

  if (!body && ['post', 'put', 'patch'].includes(parsed.method)) body = await readStdin();

  if (parsed.segments[0]?.startsWith('/')) {
    const rawPath = parsed.segments[0];
    const syntheticRoute: Route = { path: rawPath, method: parsed.method, summary: '', version: '', segments: [] };
    await execute(manifest, { route: syntheticRoute, params: {} }, {
      headers: parsed.headers, query, body, token: parsed.token,
      verbose: parsed.verbose, dryRun: parsed.dryRun,
    });
    return;
  }

  const match = matchRoute(manifest, parsed.segments, parsed.method);

  if (!match) {
    process.stderr.write(`No ${parsed.method.toUpperCase()} route matching: ${parsed.segments.join(' ')}\n`);

    for (const m of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      if (m === parsed.method) continue;
      const alt = matchRoute(manifest, parsed.segments, m);
      if (alt) {
        const flag = m === 'delete' ? '-d' : `--${m}`;
        process.stderr.write(`  try: godmode ${apiName} ${parsed.segments.join(' ')} ${flag}\n`);
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

    process.exit(1);
  }

  await execute(manifest, match, {
    headers: parsed.headers, query, body, token: parsed.token,
    verbose: parsed.verbose, dryRun: parsed.dryRun,
  });
}

main().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
