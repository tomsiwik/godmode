import { describe, expect, it } from 'vitest';
import '../src/builtin-interfaces.js';
import { InterfaceRegistry, interfaceRegistry } from '../src/interface-registry.js';
import type { InterfaceData, ManifestSource } from '../src/spec.js';
import { Interface, type InterfaceContext } from '../src/interfaces.js';

describe('interface class registry', () => {
  it('accepts extension-defined lowercase interface names', () => {
    const registry = new InterfaceRegistry();
    class AppInterface extends Interface {
      static readonly key = 'app';
      static readonly usage = ' <action> <application>';
      static async compile(): Promise<InterfaceData> {
        return {
          type: 'app', specVersion: 'test', versions: [], resourceDescriptions: {}, routes: [],
        };
      }
      async execute(): Promise<void> {}
    }

    registry.register(AppInterface);

    expect(registry.has('app')).toBe(true);
    expect(registry.get('app')).toBe(AppInterface);
    expect(registry.names()).toEqual(['app']);
  });

  it('rejects invalid names and prevents classes from overriding an owner', () => {
    const registry = new InterfaceRegistry();
    class ApiInterface extends Interface {
      static readonly key = 'api';
      static readonly usage = '';
      static async compile(): Promise<InterfaceData> {
        return {
          type: 'api', specVersion: 'test', versions: [], resourceDescriptions: {}, routes: [],
        };
      }
      async execute(): Promise<void> {}
    }
    class OtherApiInterface extends ApiInterface {}
    class UppercaseInterface extends ApiInterface { static readonly key = 'API'; }
    registry.register(ApiInterface);

    expect(() => registry.register(OtherApiInterface)).toThrow(
      "Interface 'api' is already registered",
    );
    expect(() => registry.register(UppercaseInterface)).toThrow(
      "Invalid interface name 'API'",
    );
  });

  it('registers built-in compilers and handlers through the same named seam', () => {
    expect(interfaceRegistry.names()).toEqual(['api', 'graphql', 'mcp']);
  });

  it('uses one extension-defined class for compilation and runtime dispatch', async () => {
    class AppInterface extends Interface {
      static readonly key = 'app';
      static readonly usage = ' <action> <application>';
      static async compile(): Promise<InterfaceData> {
        return {
          type: 'app', specVersion: 'test', versions: [], resourceDescriptions: {}, routes: [],
        };
      }
      async execute(): Promise<void> {}
    }
    const registry = new InterfaceRegistry();
    registry.register(AppInterface);

    const source: ManifestSource = {
      name: 'App fixture',
      interfaces: { app: { application: 'Finder' } },
    };
    expect(await registry.get('app')!.compile('app-fixture', source)).toMatchObject({
      type: 'app',
      specVersion: 'test',
    });

    const handler = registry.create({ iface: 'app' } as InterfaceContext);
    expect(handler).toBeInstanceOf(AppInterface);
    expect(registry.usage('app')).toBe(' <action> <application>');
  });
});
