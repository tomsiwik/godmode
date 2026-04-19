import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gm } from './adapter';

const seg = (value: string, isParam = false) => ({ value, isParam });

describe('core CLI', () => {
  beforeAll(async () => {
    const home = await mkdtemp(resolve(tmpdir(), 'godmode-cli-test-'));
    process.env.HOME = home;
    delete process.env.XDG_CONFIG_HOME;
    await mkdir(resolve(home, '.godmode', 'apis'), { recursive: true });
    await writeFile(
      resolve(home, '.godmode', 'apis', 'stripe.json'),
      `${JSON.stringify({
        name: 'Stripe',
        slug: 'stripe',
        description: 'Stripe test fixture',
        auth: { env: 'STRIPE_API_KEY', type: 'bearer' },
        interfaces: {
          api: {
            type: 'api',
            specVersion: 'test',
            url: 'https://api.stripe.com',
            versions: [
              { name: 'v1', prefix: '/v1' },
              { name: 'v2', prefix: '/v2' },
            ],
            resourceDescriptions: {
              customers: 'Customer resources',
              charges: 'Charge resources',
              billing: 'Billing resources',
              account: 'Account details',
              balance_transactions: 'Customer balance transactions',
              meter_events: 'Meter events',
            },
            routes: [
              { path: '/v1/customers', method: 'get', summary: 'List customers', version: 'v1', segments: [seg('customers')] },
              { path: '/v1/customers', method: 'post', summary: 'Create customer', version: 'v1', segments: [seg('customers')] },
              { path: '/v1/customers/{customer}', method: 'delete', summary: 'Delete customer', version: 'v1', segments: [seg('customers'), seg('customer', true)] },
              { path: '/v1/customers/{customer}/balance_transactions', method: 'get', summary: 'List customer balance transactions', version: 'v1', segments: [seg('customers'), seg('customer', true), seg('balance_transactions')] },
              { path: '/v1/charges', method: 'get', summary: 'List charges', version: 'v1', segments: [seg('charges')] },
              { path: '/v1/account', method: 'get', summary: 'Retrieve account', version: 'v1', segments: [seg('account')] },
              { path: '/v1/billing/meter_events', method: 'post', summary: 'Create meter event', version: 'v1', segments: [seg('billing'), seg('meter_events')] },
              { path: '/v2/billing/meter_events', method: 'post', summary: 'Create meter event', version: 'v2', segments: [seg('billing'), seg('meter_events')] },
            ],
          },
        },
      }, null, 2)}\n`,
    );
  });

  // ── httpie-style params ───────────────────────────────

  it.each([
    {
      name: 'key==value → query string',
      args: ['stripe', 'api', 'customers', 'limit==10', '--dry-run'],
      expected: 'GET https://api.stripe.com/v1/customers?limit=10',
    },
    {
      name: 'multiple query params',
      args: ['stripe', 'api', 'charges', 'limit==5', 'currency==usd', '--dry-run'],
      contains: ['limit=5', 'currency=usd'],
    },
    {
      name: 'key=value → body (implies POST)',
      args: ['stripe', 'api', 'customers', 'email=a@b.com', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers', '"email":"a@b.com"'],
    },
    {
      name: 'multiple body fields',
      args: ['stripe', 'api', 'customers', 'email=a@b.com', 'name=Test', '--dry-run'],
      contains: ['POST', '"email":"a@b.com"', '"name":"Test"'],
    },
    {
      name: 'body sets Content-Type',
      args: ['stripe', 'api', 'customers', 'email=x', '--dry-run', '--verbose'],
      contains: ['Content-Type: application/json'],
    },
    {
      name: 'query + body together',
      args: ['stripe', 'api', 'customers', 'email=x', 'expand==sources', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers?expand=sources', '"email":"x"'],
    },
  ])('$name', ({ args, expected, contains }) => {
    const out = gm(...args);
    if (expected) expect(out).toBe(expected);
    if (contains) for (const c of contains) expect(out).toContain(c);
  });

  // ── method flags ──────────────────────────────────────

  it.each([
    {
      name: '-po explicit POST',
      args: ['stripe', 'api', 'customers', '-po', 'email=x', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers'],
    },
    {
      name: '-d DELETE',
      args: ['stripe', 'api', 'customers', 'cus_1', '-d', '--dry-run'],
      expected: 'DELETE https://api.stripe.com/v1/customers/cus_1',
    },
    {
      name: '-g explicit GET',
      args: ['stripe', 'api', 'customers', '-g', '--dry-run'],
      expected: 'GET https://api.stripe.com/v1/customers',
    },
  ])('$name', ({ args, expected, contains }) => {
    const out = gm(...args);
    if (expected) expect(out).toBe(expected);
    if (contains) for (const c of contains) expect(out).toContain(c);
  });

  // ── raw path ──────────────────────────────────────────

  it.each([
    {
      name: 'GET raw path',
      args: ['stripe', 'api', '/v1/customers', '--dry-run'],
      expected: 'GET https://api.stripe.com/v1/customers',
    },
    {
      name: 'POST raw path with body',
      args: ['stripe', 'api', '/v1/customers', 'email=x', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers', '"email":"x"'],
    },
    {
      name: 'DELETE raw path',
      args: ['stripe', 'api', '/v1/customers/cus_123', '-d', '--dry-run'],
      expected: 'DELETE https://api.stripe.com/v1/customers/cus_123',
    },
  ])('$name', ({ args, expected, contains }) => {
    const out = gm(...args);
    if (expected) expect(out).toBe(expected);
    if (contains) for (const c of contains) expect(out).toContain(c);
  });

  // ── version prefix ────────────────────────────────────

  it.each([
    {
      name: 'explicit v1 overrides v2',
      args: ['stripe', 'api', 'v1', 'billing', 'meter_events', '-po', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/billing/meter_events'],
    },
    {
      name: 'default picks latest (v2)',
      args: ['stripe', 'api', 'billing', 'meter_events', '-po', '--dry-run'],
      contains: ['POST https://api.stripe.com/v2/billing/meter_events'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  // ── headers & auth ────────────────────────────────────

  it.each([
    {
      name: '-H custom header',
      args: ['stripe', 'api', 'account', '-H', 'X-Custom:value', '--dry-run', '--verbose'],
      contains: ['X-Custom: value'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  it('missing auth errors with env var name', () => {
    if (process.env.STRIPE_API_KEY) return;
    expect(gm('stripe', 'api', 'account')).toContain('Missing STRIPE_API_KEY');
  });

  // ── navigation ────────────────────────────────────────

  it.each([
    {
      name: '--help shows resources and auth',
      args: ['stripe', 'api', '--help'],
      contains: ['Usage:', 'Resources:', 'STRIPE_API_KEY'],
    },
    {
      name: 'resource --help shows commands and auth',
      args: ['stripe', 'api', 'customers', '--help'],
      contains: ['customers', 'STRIPE_API_KEY'],
    },
    {
      name: 'deep --help shows commands with descriptions',
      args: ['stripe', 'api', 'customers', 'balance_transactions', '--help'],
      contains: ['balance_transactions', 'List customer balance transactions'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  // ── errors ────────────────────────────────────────────

  it.each([
    { name: 'wrong method', args: ['stripe', 'api', 'account', '-d'], contains: 'No DELETE route' },
    { name: 'unknown resource', args: ['stripe', 'api', 'nonexistent'], contains: 'No GET route' },
  ])('$name', ({ args, contains }) => {
    expect(gm(...args)).toContain(contains);
  });
});

// ── auth types ───────────────────────────────────────────────

describe('auth types', () => {
  const authRoute = {
    path: '/ping',
    method: 'get',
    summary: 'ping',
    version: '',
    segments: [seg('ping')],
  };

  function authFixture(slug: string, auth: { env: string; type: string; header?: string }) {
    return {
      name: slug,
      slug,
      description: `${auth.type} auth fixture`,
      auth,
      interfaces: {
        api: {
          type: 'api',
          specVersion: 'test',
          url: 'https://example.com',
          versions: [],
          resourceDescriptions: {},
          routes: [authRoute],
        },
      },
    };
  }

  beforeAll(async () => {
    const home = process.env.HOME!;
    const apis = resolve(home, '.godmode', 'apis');
    await mkdir(apis, { recursive: true });
    await writeFile(
      resolve(apis, 'authbearer.json'),
      `${JSON.stringify(authFixture('authbearer', { env: 'AUTH_BEARER', type: 'bearer' }), null, 2)}\n`,
    );
    await writeFile(
      resolve(apis, 'authapikey.json'),
      `${JSON.stringify(authFixture('authapikey', { env: 'AUTH_KEY', type: 'api-key', header: 'X-Custom-Key' }), null, 2)}\n`,
    );
    await writeFile(
      resolve(apis, 'authbasic.json'),
      `${JSON.stringify(authFixture('authbasic', { env: 'AUTH_BASIC', type: 'basic' }), null, 2)}\n`,
    );
  });

  it.each([
    {
      label: 'bearer puts token in Authorization: Bearer',
      envKey: 'AUTH_BEARER',
      envVal: 'tok_bearer_abc',
      args: ['authbearer', 'api', 'ping', '--dry-run', '--verbose'],
      contains: 'Authorization: Bearer tok_bearer_abc',
    },
    {
      label: 'api-key puts token in custom header',
      envKey: 'AUTH_KEY',
      envVal: 'key_xyz',
      args: ['authapikey', 'api', 'ping', '--dry-run', '--verbose'],
      contains: 'X-Custom-Key: key_xyz',
    },
    {
      label: 'basic puts token in Authorization: Basic',
      envKey: 'AUTH_BASIC',
      envVal: 'dXNlcjpwYXNz',
      args: ['authbasic', 'api', 'ping', '--dry-run', '--verbose'],
      contains: 'Authorization: Basic dXNlcjpwYXNz',
    },
  ])('$label', ({ envKey, envVal, args, contains }) => {
    process.env[envKey] = envVal;
    try {
      const out = gm(...args);
      expect(out).toContain(contains);
    } finally {
      delete process.env[envKey];
    }
  });

  it('bearer is the default when type is omitted', async () => {
    const home = process.env.HOME!;
    await writeFile(
      resolve(home, '.godmode', 'apis', 'authdefault.json'),
      `${JSON.stringify(authFixture('authdefault', { env: 'AUTH_DEFAULT', type: 'bearer' }), null, 2)}\n`,
    );
    process.env.AUTH_DEFAULT = 'default_tok';
    try {
      expect(
        gm('authdefault', 'api', 'ping', '--dry-run', '--verbose'),
      ).toContain('Authorization: Bearer default_tok');
    } finally {
      delete process.env.AUTH_DEFAULT;
    }
  });

  it('missing-token message reflects the auth type', () => {
    expect(gm('authbearer', 'api', '--help')).toContain('missing bearer token');
    expect(gm('authapikey', 'api', '--help')).toContain('missing api-key');
    expect(gm('authbasic', 'api', '--help')).toContain('missing basic auth credentials');
  });
});
