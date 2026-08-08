const INTERFACE_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Registry with first-owner-wins semantics for extension interface providers. */
export class InterfaceRegistry<T> {
  private readonly providers = new Map<string, T>();

  register(name: string, provider: T): void {
    if (!INTERFACE_NAME.test(name)) {
      throw new Error(
        `Invalid interface name '${name}' (expected lowercase letters, numbers, and hyphens)`,
      );
    }
    if (this.providers.has(name)) {
      throw new Error(`Interface '${name}' is already registered`);
    }
    this.providers.set(name, provider);
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  get(name: string): T | undefined {
    return this.providers.get(name);
  }

  names(): string[] {
    return [...this.providers.keys()].sort();
  }
}
