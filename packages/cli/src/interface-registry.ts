import type {
  InterfaceClass,
  InterfaceContext,
  InterfaceHandler,
} from './interfaces/base.js';

const INTERFACE_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Registry of the interface classes available in this process. */
export class InterfaceRegistry {
  private readonly classes = new Map<string, InterfaceClass>();

  register(InterfaceType: InterfaceClass): void {
    const { key } = InterfaceType;
    if (!INTERFACE_NAME.test(key)) {
      throw new Error(
        `Invalid interface name '${key}' (expected lowercase letters, numbers, and hyphens)`,
      );
    }
    if (this.classes.has(key)) throw new Error(`Interface '${key}' is already registered`);
    this.classes.set(key, InterfaceType);
  }

  has(key: string): boolean { return this.classes.has(key); }
  get(key: string): InterfaceClass | undefined { return this.classes.get(key); }
  names(): string[] { return [...this.classes.keys()].sort(); }
  usage(key: string): string { return this.classes.get(key)?.usage || ' <command> [args]'; }

  create(ctx: InterfaceContext): InterfaceHandler {
    const InterfaceType = this.classes.get(ctx.iface);
    if (!InterfaceType) throw new Error(`Unknown interface: ${ctx.iface}`);
    return new InterfaceType(ctx);
  }
}

export const interfaceRegistry = new InterfaceRegistry();
