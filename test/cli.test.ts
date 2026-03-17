import { describe, it, expect, beforeAll } from 'vitest';
import { gm } from './adapter';

/**
 * Core CLI behavior tests — flags, params, raw paths, auth, navigation.
 * Uses stripe adapter as the test subject (must be registered).
 */

describe('core CLI', () => {
  beforeAll(() => {
    if (!gm('list').includes('stripe')) throw new Error('Run stripe adapter test first');
  });

  describe('-q params', () => {
    it('GET: query string', () => {
      expect(gm('stripe', 'customers', '-q', 'limit=10', '--dry-run'))
        .toBe('GET https://api.stripe.com/v1/customers?limit=10');
    });

    it('GET: multiple', () => {
      const out = gm('stripe', 'charges', '-q', 'limit=5', '-q', 'currency=usd', '--dry-run');
      expect(out).toContain('limit=5');
      expect(out).toContain('currency=usd');
    });

    it('POST: JSON body', () => {
      const out = gm('stripe', 'customers', '--post', '-q', 'email=a@b.com', '-q', 'name=Test', '--dry-run');
      expect(out).toContain('POST https://api.stripe.com/v1/customers');
      expect(out).toContain('"email":"a@b.com"');
      expect(out).toContain('"name":"Test"');
    });

    it('POST: Content-Type set', () => {
      const out = gm('stripe', 'customers', '--post', '-q', 'email=x', '--dry-run', '--verbose');
      expect(out).toContain('Content-Type: application/json');
    });
  });

  describe('raw path', () => {
    it('GET', () => {
      expect(gm('stripe', '/v1/customers', '--dry-run'))
        .toBe('GET https://api.stripe.com/v1/customers');
    });

    it('POST with body', () => {
      const out = gm('stripe', '/v1/customers', '--post', '-q', 'email=x', '--dry-run');
      expect(out).toContain('POST https://api.stripe.com/v1/customers');
      expect(out).toContain('"email":"x"');
    });

    it('DELETE', () => {
      expect(gm('stripe', '/v1/customers/cus_123', '-d', '--dry-run'))
        .toBe('DELETE https://api.stripe.com/v1/customers/cus_123');
    });
  });

  describe('version prefix', () => {
    it('explicit v1 overrides v2 default', () => {
      expect(gm('stripe', 'v1', 'billing', 'meter_events', '--post', '--dry-run'))
        .toContain('POST https://api.stripe.com/v1/billing/meter_events');
    });

    it('default picks latest', () => {
      expect(gm('stripe', 'billing', 'meter_events', '--post', '--dry-run'))
        .toContain('POST https://api.stripe.com/v2/billing/meter_events');
    });
  });

  describe('-d delete', () => {
    it('sends DELETE', () => {
      expect(gm('stripe', 'customers', 'cus_1', '-d', '--dry-run'))
        .toBe('DELETE https://api.stripe.com/v1/customers/cus_1');
    });
  });

  describe('-H headers', () => {
    it('custom header', () => {
      const out = gm('stripe', 'account', '-H', 'X-Custom:value', '--dry-run', '--verbose');
      expect(out).toContain('X-Custom: value');
    });

    it('multiple headers', () => {
      const out = gm('stripe', 'account', '-H', 'A:1', '-H', 'B:2', '--dry-run', '--verbose');
      expect(out).toContain('A: 1');
      expect(out).toContain('B: 2');
    });
  });

  describe('--token auth', () => {
    it('sets Bearer', () => {
      const out = gm('stripe', 'account', '--token', 'sk_test', '--dry-run', '--verbose');
      expect(out).toContain('Authorization: Bearer sk_test');
    });

    it('not in URL', () => {
      const urlLine = gm('stripe', 'account', '--token', 'sk_test', '--dry-run').split('\n')[0];
      expect(urlLine).toBe('GET https://api.stripe.com/v1/account');
    });
  });

  describe('missing auth', () => {
    it('errors with env var name when not dry-run', () => {
      if (process.env.STRIPE_API_KEY) return; // skip if key is set
      // Without --dry-run, should error before making request
      const out = gm('stripe', 'account');
      expect(out).toContain('Missing STRIPE_API_KEY');
    });
  });

  describe('navigation', () => {
    it('--help: shows resources and auth', () => {
      const out = gm('stripe', '--help');
      expect(out).toContain('Usage:');
      expect(out).toContain('Resources:');
      expect(out).toContain('STRIPE_API_KEY');
    });
    it('resource --help: shows operations and sub-resources', () => {
      const out = gm('stripe', 'customers', '--help');
      expect(out).toContain('list');
      expect(out).toContain('create');
      expect(out).toContain('Resources:');
    });
    it('deep --help: navigates through params', () => {
      const out = gm('stripe', 'customers', 'balance_transactions', '--help');
      expect(out).toContain('balance_transactions');
      expect(out).toContain('list');
    });
  });

  describe('errors', () => {
    it('wrong method', () => expect(gm('stripe', 'account', '-d')).toContain('No DELETE route'));
    it('unknown resource', () => expect(gm('stripe', 'nonexistent')).toContain('No GET route'));
  });
});
