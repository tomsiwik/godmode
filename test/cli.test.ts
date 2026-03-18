import { describe, it, expect, beforeAll } from 'vitest';
import { gm } from './adapter';

describe('core CLI', () => {
  beforeAll(() => {
    if (!gm('list').includes('stripe')) throw new Error('Run stripe adapter test first');
  });

  // ── httpie-style params ───────────────────────────────

  it.each([
    {
      name: 'key==value → query string',
      args: ['stripe', 'customers', 'limit==10', '--dry-run'],
      expected: 'GET https://api.stripe.com/v1/customers?limit=10',
    },
    {
      name: 'multiple query params',
      args: ['stripe', 'charges', 'limit==5', 'currency==usd', '--dry-run'],
      contains: ['limit=5', 'currency=usd'],
    },
    {
      name: 'key=value → body (implies POST)',
      args: ['stripe', 'customers', 'email=a@b.com', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers', '"email":"a@b.com"'],
    },
    {
      name: 'multiple body fields',
      args: ['stripe', 'customers', 'email=a@b.com', 'name=Test', '--dry-run'],
      contains: ['POST', '"email":"a@b.com"', '"name":"Test"'],
    },
    {
      name: 'body sets Content-Type',
      args: ['stripe', 'customers', 'email=x', '--dry-run', '--verbose'],
      contains: ['Content-Type: application/json'],
    },
    {
      name: 'query + body together',
      args: ['stripe', 'customers', 'email=x', 'expand==sources', '--dry-run'],
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
      args: ['stripe', 'customers', '-po', 'email=x', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers'],
    },
    {
      name: '-d DELETE',
      args: ['stripe', 'customers', 'cus_1', '-d', '--dry-run'],
      expected: 'DELETE https://api.stripe.com/v1/customers/cus_1',
    },
    {
      name: '-g explicit GET',
      args: ['stripe', 'customers', '-g', '--dry-run'],
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
      args: ['stripe', '/v1/customers', '--dry-run'],
      expected: 'GET https://api.stripe.com/v1/customers',
    },
    {
      name: 'POST raw path with body',
      args: ['stripe', '/v1/customers', 'email=x', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/customers', '"email":"x"'],
    },
    {
      name: 'DELETE raw path',
      args: ['stripe', '/v1/customers/cus_123', '-d', '--dry-run'],
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
      args: ['stripe', 'v1', 'billing', 'meter_events', '-po', '--dry-run'],
      contains: ['POST https://api.stripe.com/v1/billing/meter_events'],
    },
    {
      name: 'default picks latest (v2)',
      args: ['stripe', 'billing', 'meter_events', '-po', '--dry-run'],
      contains: ['POST https://api.stripe.com/v2/billing/meter_events'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  // ── headers & auth ────────────────────────────────────

  it.each([
    {
      name: '-H custom header',
      args: ['stripe', 'account', '-H', 'X-Custom:value', '--dry-run', '--verbose'],
      contains: ['X-Custom: value'],
    },
    {
      name: '--token sets Bearer',
      args: ['stripe', 'account', '--token', 'sk_test', '--dry-run', '--verbose'],
      contains: ['Authorization: Bearer sk_test'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  it('missing auth errors with env var name', () => {
    if (process.env.STRIPE_API_KEY) return;
    expect(gm('stripe', 'account')).toContain('Missing STRIPE_API_KEY');
  });

  // ── navigation ────────────────────────────────────────

  it.each([
    {
      name: '--help shows resources and auth',
      args: ['stripe', '--help'],
      contains: ['Usage:', 'Resources:', 'STRIPE_API_KEY'],
    },
    {
      name: 'resource --help shows commands and auth',
      args: ['stripe', 'customers', '--help'],
      contains: ['customers', 'STRIPE_API_KEY'],
    },
    {
      name: 'deep --help shows commands with descriptions',
      args: ['stripe', 'customers', 'balance_transactions', '--help'],
      contains: ['balance_transactions', 'List customer balance transactions'],
    },
  ])('$name', ({ args, contains }) => {
    for (const c of contains) expect(gm(...args)).toContain(c);
  });

  // ── errors ────────────────────────────────────────────

  it.each([
    { name: 'wrong method', args: ['stripe', 'account', '-d'], contains: 'No DELETE route' },
    { name: 'unknown resource', args: ['stripe', 'nonexistent'], contains: 'No GET route' },
  ])('$name', ({ args, contains }) => {
    expect(gm(...args)).toContain(contains);
  });
});
