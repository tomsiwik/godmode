import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gmResult } from './adapter';

describe('extension slug occupancy', () => {
  async function makePackage(root: string, folderName: string, packageName: string, slug: string) {
    const pkg = resolve(root, folderName);
    await mkdir(pkg, { recursive: true });
    await writeFile(resolve(pkg, 'package.json'), JSON.stringify({
      name: packageName,
      version: '1.0.0',
      exports: { './manifest': './extension.yaml' },
    }, null, 2));
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Widget', version: '1.0.0' },
      paths: { '/v1/widgets': { get: { summary: 'List widgets', responses: { 200: { description: 'ok' } } } } },
    };
    await writeFile(resolve(pkg, 'extension.yaml'), [
      'name: Widget',
      `slug: ${slug}`,
      'interfaces:',
      '  api:',
      `    spec: data:application/json,${encodeURIComponent(JSON.stringify(spec))}`,
      '    url: https://widget.example.test',
      '',
    ].join('\n'));
    return pkg;
  }

  it('refuses built-in slugs', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'godmode-slug-'));
    for (const slug of ['ext', 'agent', 'permissions']) {
      const result = gmResult(root, 'ext', 'install', slug);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain(`'${slug}' is a built-in godmode extension`);
    }
  });

  it('refuses a slug occupied by a different package, allows reinstall of the same one', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'godmode-slug-'));
    const first = await makePackage(root, 'first', '@example/godmode-widget', 'widget');
    const second = await makePackage(root, 'second', '@example/godmode-widget-two', 'widget');

    expect(gmResult(root, 'ext', 'install', first).status).toBe(0);

    const conflict = gmResult(root, 'ext', 'install', second);
    expect(conflict.status).not.toBe(0);
    expect(conflict.output).toContain(`'widget' is already in use by @example/godmode-widget`);

    // Same package again — update path, not a conflict.
    expect(gmResult(root, 'ext', 'install', first).status).toBe(0);
    expect(gmResult(root, 'ext', 'update', 'widget').status).toBe(0);
  });
});
