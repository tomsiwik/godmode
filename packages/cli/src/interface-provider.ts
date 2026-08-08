import { InterfaceRegistry } from './interface-registry.js';
import type { Interface, InterfaceCtx } from './interfaces.js';
import type { InterfaceData, ManifestSource } from './spec.js';

export interface InterfaceProvider {
  /** Interface-specific command tail shown by extension and interface help. */
  usage?: string;
  compile(name: string, source: ManifestSource): Promise<InterfaceData>;
  create(ctx: InterfaceCtx): Interface;
}

const providers = new InterfaceRegistry<InterfaceProvider>();

export function registerInterfaceProvider(name: string, provider: InterfaceProvider): void {
  providers.register(name, provider);
}

export function getInterfaceProvider(name: string): InterfaceProvider | undefined {
  return providers.get(name);
}

export function hasInterfaceProvider(name: string): boolean {
  return providers.has(name);
}

export function registeredInterfaceProviders(): string[] {
  return providers.names();
}

export function interfaceProviderUsage(name: string): string {
  return providers.get(name)?.usage || ' <command> [args]';
}
