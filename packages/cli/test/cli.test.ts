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
        name: 'stripe',
        description: 'Stripe test fixture',
        specVersion: 'test',
        config: {
          name: 'Stripe',
          type: 'api',
          url: 'https://api.stripe.com',
          auth: { env: 'STRIPE_API_KEY', type: 'bearer' },
        },
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
      }, null, 2)}\n`,
    );
  });

  // ── httpie-style params ───────────────────────────────

  it.each([
    {
      name: 'key==value → query string',
      args: ['api', 'stripe', 'customers', 'limit==10', '--dry-run'],
      expected: 'GET https://api.stripe.com/v1/customers?limit=10',
    },
    {
      name: 'multiple query params',
      args: ['api', 'stripe', 'charges', 'limit==5', 'currency==usd', '--dry-run'],
      contains: ['limit=5', 'currency=usd'],
    },
    {
      name: 'key=value → body (implies POST)',
      args: ['api', 'stripe', 'customers', 'email=a@b.com', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers', '"email":"a@b.com"'],
    },
    {
      name: 'multiple body fields',
      args: ['api', 'stripe', 'customers', 'email=a@b.com', 'name=Test', '--dry-run'],
      contains: ['POST', '"email":"a@b.com"', '"name":"Test"'],
    },
    {
      name: 'body sets Content-Type',
      args: ['api', 'stripe', 'customers', 'email=x', '--dry-run', '--verbose'],
      contains: ['Content-Type: application/json'],
    },
    {
      name: 'query + body together',
      args: ['api', 'stripe', 'customers', 'email=x', 'expand==sources', '--dry-run'],
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
      args: ['api', 'stripe', 'customers', '-po', 'email=x', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers'],
    },
    {
      name: '-d DELETE',
      args: ['api', 'stripe', 'customers', 'cus_1', '-d', '--dry-run'],
      expected: 'DELETE https://api.stripe.com/v1/customers/cus_1',
    },
    {
      name: '-g explicit GET',
      args: ['api', 'stripe', 'customers', '-g', '--dry-run'],
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
      args: ['api', 'stripe', '/v1/customers', '--dry-run'],
      expected: 'GET https://api.stripe.com/v1/customers',
    },
    {
      name: 'POST raw path with body',
      args: ['api', 'stripe', '/v1/customers', 'email=x', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers', '"email":"x"'],
    },
    {
      name: 'DELETE raw path',
      args: ['api', 'stripe', '/v1/customers/cus_123', '-d', '--dry-run'],
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
      args: ['api', 'stripe', 'v1', 'billing', 'meter_events', '-po', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/billing/meter_events'],
    },
    {
      name: 'default picks latest (v2)',
      args: ['api', 'stripe', 'billing', 'meter_events', '-po', '--dry-run'],
      contains: ['POST https://api.stripe.com/v2/billing/meter_events'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  // ── headers & auth ────────────────────────────────────

  it.each([
    {
      name: '-H custom header',
      args: ['api', 'stripe', 'account', '-H', 'X-Custom:value', '--dry-run', '--verbose'],
      contains: ['X-Custom: value'],
    },
    {
      name: '--token sets Bearer',
      args: ['api', 'stripe', 'account', '--token', 'sk_test', '--dry-run', '--verbose'],
      contains: ['Authorization: Bearer sk_test'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  it('missing auth errors with env var name', () => {
    if (process.env.STRIPE_API_KEY) return;
    expect(gm('api', 'stripe', 'account')).toContain('Missing STRIPE_API_KEY');
  });

  // ── navigation ────────────────────────────────────────

  it.each([
    {
      name: '--help shows resources and auth',
      args: ['api', 'stripe', '--help'],
      contains: ['Usage:', 'Resources:', 'STRIPE_API_KEY'],
    },
    {
      name: 'resource --help shows commands and auth',
      args: ['api', 'stripe', 'customers', '--help'],
      contains: ['customers', 'STRIPE_API_KEY'],
    },
    {
      name: 'deep --help shows commands with descriptions',
      args: ['api', 'stripe', 'customers', 'balance_transactions', '--help'],
      contains: ['balance_transactions', 'List customer balance transactions'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  // ── errors ────────────────────────────────────────────

  it.each([
    { name: 'wrong method', args: ['api', 'stripe', 'account', '-d'], contains: 'No DELETE route' },
    { name: 'unknown resource', args: ['api', 'stripe', 'nonexistent'], contains: 'No GET route' },
  ])('$name', ({ args, contains }) => {
    expect(gm(...args)).toContain(contains);
  });
});
