import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gmIn, gmResult } from './adapter';

const seg = (value: string, isParam = false) => ({ value, isParam });

/**
 * End-to-end permission checks. Each test spins up a fresh project dir with
 * `.godmode/settings.yaml` + a project-scoped stripe extension, then runs
 * the CLI from that cwd and inspects stdout/stderr.
 */
describe('permissions', () => {
  async function makeProject(settingsYaml: string): Promise<string> {
    const dir = await mkdtemp(resolve(tmpdir(), 'godmode-perm-test-'));
    await mkdir(resolve(dir, '.godmode', 'extensions'), { recursive: true });
    await writeFile(resolve(dir, '.godmode', 'settings.yaml'), settingsYaml);
    await writeFile(
      resolve(dir, '.godmode', 'extensions', 'stripe.json'),
      JSON.stringify({
        name: 'Stripe',
        slug: 'stripe',
        description: 'Permissions fixture',
        auth: { env: 'STRIPE_API_KEY', type: 'bearer' },
        interfaces: {
          api: {
            type: 'api',
            specVersion: 'test',
            url: 'https://api.stripe-test.com',
            versions: [{ name: 'v1', prefix: '/v1' }],
            resourceDescriptions: { customers: 'x', charges: 'x', account: 'x' },
            routes: [
              { path: '/v1/customers', method: 'get', summary: '', version: 'v1', segments: [seg('customers')] },
              { path: '/v1/customers', method: 'post', summary: '', version: 'v1', segments: [seg('customers')] },
              { path: '/v1/customers/{customer}', method: 'delete', summary: '', version: 'v1', segments: [seg('customers'), seg('customer', true)] },
              { path: '/v1/charges', method: 'get', summary: '', version: 'v1', segments: [seg('charges')] },
              { path: '/v1/account', method: 'get', summary: '', version: 'v1', segments: [seg('account')] },
            ],
          },
        },
      }),
    );
    return dir;
  }

  it('no permissions block → opt-in, everything allowed', async () => {
    const dir = await makeProject('extensions:\n  stripe: {}\n');
    const out = gmIn(dir, 'stripe', 'api', 'GET', 'customers', '--dry-run');
    expect(out).toContain('api.stripe-test.com');
    expect(out).not.toContain('Blocked');
  });

  it('allow rule admits only listed resource + method', async () => {
    const dir = await makeProject(`extensions:
  stripe:
    permissions:
      allow:
        - resources: [customers]
          methods: [GET]
`);
    expect(gmIn(dir, 'stripe', 'api', 'GET', 'customers', '--dry-run')).toContain('api.stripe-test.com');
    expect(gmIn(dir, 'stripe', 'api', 'GET', 'charges', '--dry-run')).toContain('Blocked');
    expect(gmIn(dir, 'stripe', 'api', 'POST', 'customers', 'email=x', '--dry-run')).toContain('Blocked');
  });

  it('deny overrides allow', async () => {
    const dir = await makeProject(`extensions:
  stripe:
    permissions:
      allow:
        - resources: ['*']
      deny:
        - resources: [account]
`);
    expect(gmIn(dir, 'stripe', 'api', 'GET', 'customers', '--dry-run')).toContain('api.stripe-test.com');
    expect(gmIn(dir, 'stripe', 'api', 'GET', 'account', '--dry-run')).toContain('Blocked');
  });

  it('omitted resources defaults to [*]', async () => {
    const dir = await makeProject(`extensions:
  stripe:
    permissions:
      allow:
        - methods: [GET]
`);
    expect(gmIn(dir, 'stripe', 'api', 'GET', 'customers', '--dry-run')).toContain('api.stripe-test.com');
    expect(gmIn(dir, 'stripe', 'api', 'GET', 'account', '--dry-run')).toContain('api.stripe-test.com');
    expect(gmIn(dir, 'stripe', 'api', 'POST', 'customers', 'email=x', '--dry-run')).toContain('Blocked');
  });

  it('omitted methods → any method allowed within the rule', async () => {
    const dir = await makeProject(`extensions:
  stripe:
    permissions:
      allow:
        - resources: [customers]
`);
    expect(gmIn(dir, 'stripe', 'api', 'GET', 'customers', '--dry-run')).toContain('api.stripe-test.com');
    expect(gmIn(dir, 'stripe', 'api', 'POST', 'customers', 'email=x', '--dry-run')).toContain('api.stripe-test.com');
  });

  it('default deny when a block exists and no allow matches', async () => {
    const dir = await makeProject(`extensions:
  stripe:
    permissions:
      allow:
        - resources: [charges]
`);
    const out = gmIn(dir, 'stripe', 'api', 'GET', 'customers', '--dry-run');
    expect(out).toContain('Blocked');
    expect(out).toContain('no allow rule matches');
  });

  it('raw paths are checked against the same deny rules as named routes', async () => {
    const dir = await makeProject(`extensions:
  stripe:
    permissions:
      allow:
        - resources: ['*']
      deny:
        - resources: [charges]
`);
    const result = gmResult(dir, 'stripe', 'api', 'GET', '/v1/charges', '--dry-run');
    expect(result.status).toBe(4);
    expect(result.output).toContain('Blocked');
    expect(result.output).toContain('charges');
    expect(result.output).not.toContain('api.stripe-test.com');
  });

  it('invalid settings fail closed for permissioned dispatch but list still works with a warning', async () => {
    const dir = await makeProject(`extensions:\n  stripe:\n    permissions: [\n`);
    const dispatch = gmResult(dir, 'stripe', 'api', 'GET', 'customers', '--dry-run');
    expect(dispatch.status).toBe(4);
    expect(dispatch.output).toContain('cannot parse');
    expect(dispatch.output).toContain('refusing to run with an unreadable policy');
    expect(dispatch.output).not.toContain('api.stripe-test.com');

    const list = gmResult(dir, 'ext', 'list');
    expect(list.status).toBe(0);
    expect(list.output).toContain('Warning: cannot parse');
    expect(list.output).toContain('stripe');
  });

  it('permissions explain reports decisions and suggested allow rules', async () => {
    const dir = await makeProject(`extensions:
  stripe:
    permissions:
      allow:
        - resources: [customers]
          methods: [GET]
`);
    const allowed = gmResult(dir, 'permissions', 'explain', 'stripe', 'api', 'customers', 'GET');
    expect(allowed.status).toBe(0);
    expect(allowed.output).toContain('allow stripe api customers GET');
    expect(allowed.output).toContain('winning rule');

    const denied = gmResult(dir, 'permissions', 'explain', 'stripe', 'api', 'charges', 'GET');
    expect(denied.status).toBe(4);
    expect(denied.output).toContain('deny stripe api charges GET');
    expect(denied.output).toContain('suggested allow rule');
  });

  it('permissions explain uses route resources for raw parameterized paths', async () => {
    const dir = await makeProject(`extensions:
  stripe:
    permissions:
      allow:
        - resources: [customers]
          methods: [DELETE]
`);
    const allowed = gmResult(dir, 'permissions', 'explain', 'stripe', 'api', '/v1/customers/cus_123', 'DELETE');
    expect(allowed.status).toBe(0);
    expect(allowed.output).toContain('allow stripe api /v1/customers/cus_123 DELETE');
    expect(allowed.output).toContain('resources=[customers]');

    const denied = gmResult(dir, 'permissions', 'explain', 'stripe', 'api', '/v1/charges/ch_123', 'GET');
    expect(denied.status).toBe(4);
    expect(denied.output).toContain('resources: [charges.ch_123]');
  });
});
