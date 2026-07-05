import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { gmIn, gmResult } from './adapter';

describe('npm extension install', () => {
  async function makePackage() {
    const root = await mkdtemp(resolve(tmpdir(), 'godmode-npm-ext-'));
    const pkg = resolve(root, 'pkg');
    await mkdir(pkg, { recursive: true });
    await writeFile(resolve(pkg, 'package.json'), JSON.stringify({
      name: '@example/godmode-widget',
      version: '1.0.0',
      exports: { './manifest': './extension.yaml' },
    }, null, 2));
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Widget', version: '1.0.0' },
      paths: {
        '/v1/widgets': {
          get: {
            summary: 'List widgets',
            responses: { 200: { description: 'ok' } },
          },
        },
      },
    };
    await writeFile(resolve(pkg, 'extension.yaml'), [
      'name: Widget',
      'slug: widget',
      'description: Local npm package fixture',
      'interfaces:',
      '  api:',
      `    spec: data:application/json,${encodeURIComponent(JSON.stringify(spec))}`,
      '    url: https://widget.example.test',
      '',
    ].join('\n'));
    return { root, pkg };
  }

  it('installs, lists, invokes, and uninstalls package manifest exports', async () => {
    const { root, pkg } = await makePackage();

    const install = gmResult(root, 'ext', 'install', pkg);
    expect(install.status).toBe(0);
    expect(install.output).toContain('Registered "widget"');

    const list = gmIn(root, 'ext', 'list');
    expect(list).toContain('widget');
    expect(list).toContain('npm');

    expect(gmIn(root, 'widget', 'api', 'GET', 'widgets', '--dry-run')).toContain(
      'GET https://widget.example.test/v1/widgets',
    );

    const packageDir = resolve(root, '.godmode', 'node_modules', '@example', 'godmode-widget');
    expect(existsSync(packageDir)).toBe(true);

    const uninstall = gmResult(root, 'ext', 'uninstall', 'widget');
    expect(uninstall.status).toBe(0);
    expect(gmIn(root, 'ext', 'list')).not.toContain('widget');
    expect(existsSync(packageDir)).toBe(false);
  });
});
