import type { Manifest } from 'godmode/spec';
import type { Match } from './match.js';

interface RequestOptions {
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

export async function executeToString(manifest: Manifest, match: Match, options: RequestOptions): Promise<string> {
  const baseUrl = manifest.config.url;
  if (!baseUrl) {
    throw new Error('No base URL configured. Add "url" to your config file.');
  }

  // Fill path params
  let path = match.route.path;
  for (const [key, value] of Object.entries(match.params)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }

  const url = new URL(baseUrl.replace(/\/$/, '') + path);
  for (const [key, value] of Object.entries(options.query)) {
    url.searchParams.set(key, value);
  }

  // Build headers: config defaults → per-request overrides
  const headers: Record<string, string> = { ...manifest.config.headers, ...options.headers };

  const authConfig = manifest.config.auth;
  const token = authConfig?.env ? process.env[authConfig.env] : undefined;

  if (authConfig?.env && !token && !options.dryRun) {
    throw new Error(`Missing ${authConfig.env}. Set it in .env or export it in your shell.`);
  }

  if (token) {
    const authType = authConfig?.type || 'bearer';
    if (authType === 'bearer') {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'api-key') {
      headers[authConfig?.header || 'X-API-Key'] = token;
    } else if (authType === 'basic') {
      headers['Authorization'] = `Basic ${token}`;
    }
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const method = match.route.method.toUpperCase();

  if (options.dryRun || options.verbose) {
    process.stderr.write(`${method} ${url.toString()}\n`);
    for (const [k, v] of Object.entries(headers)) {
      process.stderr.write(`  ${k}: ${v}\n`);
    }
    if (options.body) {
      const preview = options.body.length > 200 ? options.body.slice(0, 200) + '...' : options.body;
      process.stderr.write(`  Body: ${preview}\n`);
    }
    if (options.dryRun) return '';
    process.stderr.write('\n');
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: options.body || undefined,
  });

  if (options.verbose) {
    process.stderr.write(`${response.status} ${response.statusText}\n`);
    response.headers.forEach((v, k) => process.stderr.write(`  ${k}: ${v}\n`));
    process.stderr.write('\n');
  }

  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  let result: string;
  if (contentType.includes('json')) {
    try { result = JSON.stringify(JSON.parse(text), null, 2); }
    catch { result = text; }
  } else {
    result = text;
  }

  if (!response.ok) throw new Error(result);
  return result;
}

export async function execute(manifest: Manifest, match: Match, options: RequestOptions) {
  try {
    const result = await executeToString(manifest, match, options);
    if (result) process.stdout.write(result + '\n');
  } catch (err: any) {
    process.stderr.write(err.message + '\n');
    process.exit(1);
  }
}
