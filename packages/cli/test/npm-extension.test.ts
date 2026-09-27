import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { gmIn, gmResult } from './adapter';

describe('npm extension install', () => {
  async function makePackage(folderName = 'pkg') {
    const root = await mkdtemp(resolve(tmpdir(), 'godmode-npm-ext-'));
    const pkg = resolve(root, folderName);
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

  it('installs local package paths that contain spaces without shell splitting', async () => {
    const { root, pkg } = await makePackage('pkg with spaces');

    const install = gmResult(root, 'ext', 'install', pkg);
    expect(install.status).toBe(0);
    expect(install.output).toContain('Registered "widget"');
    expect(gmIn(root, 'widget', 'api', 'GET', 'widgets', '--dry-run')).toContain(
      'GET https://widget.example.test/v1/widgets',
    );
  });

  it('loads a custom interface class exported by an extension package', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'godmode-custom-interface-'));
    const pkg = resolve(root, 'app-extension');
    await mkdir(pkg, { recursive: true });
    await writeFile(resolve(pkg, 'package.json'), JSON.stringify({
      name: '@example/godmode-app',
      version: '1.0.0',
      type: 'module',
      exports: {
        './manifest': './extension.yaml',
        './interface': { import: './app-interface.js' },
      },
    }, null, 2));
    await writeFile(resolve(pkg, 'extension.yaml'), [
      'name: App fixture',
      'slug: app-fixture',
      'interfaces:',
      '  app:',
      '    application: Finder',
      '',
    ].join('\n'));
    await writeFile(resolve(pkg, 'app-interface.js'), `
export default class AppInterface {
  static key = 'app';
  static usage = ' <action> <application>';

  static async compile(_name, source) {
    return {
      type: 'app',
      application: source.interfaces.app.application,
      specVersion: 'app-v1',
      versions: [],
      resourceDescriptions: {},
      routes: [],
    };
  }

  constructor(ctx) { this.ctx = ctx; }
  showHelp() { process.stdout.write('Usage: godmode app-fixture app <action> <application>\\n'); }
  async handleEmpty() { this.showHelp(); }
  validate() { return null; }
  async execute() { process.stdout.write(this.ctx.parsed.segments.join(':') + '\\n'); }
}
`);

    const install = gmResult(root, 'ext', 'install', pkg);
    expect(install.status).toBe(0);
    expect(install.output).toContain('Registered "app-fixture"');
    expect(gmIn(root, 'app-fixture', '--help')).toContain(
      'godmode app-fixture app <action> <application>',
    );
    expect(gmIn(root, 'app-fixture', 'app', 'open', 'Finder')).toBe('open:Finder');
  });

  it('does not delete outside node_modules when an installed manifest is tampered with', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'godmode-npm-ext-'));
    const victim = resolve(root, 'victim');
    await mkdir(resolve(root, '.godmode', 'extensions'), { recursive: true });
    await mkdir(victim, { recursive: true });
    await writeFile(resolve(victim, 'keep.txt'), 'keep');
    await writeFile(resolve(root, '.godmode', 'extensions', 'evil.json'), JSON.stringify({
      name: 'Evil',
      slug: 'evil',
      description: '',
      source: 'npm',
      packageName: '../victim',
      interfaces: {},
    }));

    const uninstall = gmResult(root, 'ext', 'uninstall', 'evil');
    expect(uninstall.status).not.toBe(0);
    expect(uninstall.output).toContain('Invalid npm package name');
    expect(existsSync(victim)).toBe(true);
    expect(existsSync(resolve(root, '.godmode', 'extensions', 'evil.json'))).toBe(true);
  });
});
