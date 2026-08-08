import { describe, expect, it } from 'vitest';
import '../src/builtin-interface-providers.js';
import { InterfaceRegistry } from '../src/interface-registry.js';
import {
  interfaceProviderUsage,
  registerInterfaceProvider,
  registeredInterfaceProviders,
} from '../src/interface-provider.js';
import { compileInterface, type ManifestSource } from '../src/spec.js';
import { getInterface, Interface, type InterfaceCtx } from '../src/interfaces.js';

describe('interface provider registry', () => {
  it('accepts extension-defined lowercase interface names', () => {
    const registry = new InterfaceRegistry<{ id: string }>();

    registry.register('desktop', { id: 'desktop-provider' });

    expect(registry.has('desktop')).toBe(true);
    expect(registry.get('desktop')).toEqual({ id: 'desktop-provider' });
    expect(registry.names()).toEqual(['desktop']);
  });

  it('rejects invalid names and prevents providers from overriding an owner', () => {
    const registry = new InterfaceRegistry<{ id: string }>();
    registry.register('api', { id: 'first' });

    expect(() => registry.register('api', { id: 'second' })).toThrow(
      "Interface 'api' is already registered",
    );
    expect(() => registry.register('API', { id: 'uppercase' })).toThrow(
      "Invalid interface name 'API'",
    );
  });

  it('registers built-in compilers and handlers through the same named seam', () => {
    expect(registeredInterfaceProviders()).toEqual(['api', 'graphql', 'mcp']);
  });

  it('uses one extension-defined provider for compilation and runtime dispatch', async () => {
    class DesktopInterface extends Interface {
      async execute(): Promise<void> {}
    }

    registerInterfaceProvider('desktop', {
      usage: ' <application> [flags]',
      compile: async () => ({
        type: 'desktop',
        specVersion: 'test',
        versions: [],
        resourceDescriptions: {},
        routes: [],
      }),
      create: (ctx) => new DesktopInterface(ctx),
    });

    const source: ManifestSource = {
      name: 'Desktop fixture',
      interfaces: { desktop: { application: 'Finder' } },
    };
    expect(await compileInterface('desktop', 'desktop-fixture', source)).toMatchObject({
      type: 'desktop',
      specVersion: 'test',
    });

    const handler = getInterface({ iface: 'desktop' } as InterfaceCtx);
    expect(handler).toBeInstanceOf(DesktopInterface);
    expect(interfaceProviderUsage('desktop')).toBe(' <application> [flags]');
  });
});
