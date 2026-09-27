import type { ParsedArgs } from '../args.js';
import { showApiHelp } from '../help.js';
import type { Config } from '../config.js';
import type {
  InterfaceData,
  InterfaceKey,
  Manifest,
  ManifestSource,
  MultiManifest,
} from '../spec.js';

export interface InterfaceContext {
  iface: InterfaceKey;
  extensionName: string;
  manifest: Manifest;
  multi: MultiManifest;
  parsed: ParsedArgs;
  config: Config;
  /** Original argv tail passed to the interface. */
  rawRest: string[];
}

export interface InterfaceHandler {
  handleEmpty(): Promise<void>;
  validate(): string | null;
  execute(): Promise<void>;
  showHelp(): void;
}

/** Static and instance contract exported by an interface module. */
export interface InterfaceClass {
  readonly key: string;
  readonly usage: string;
  compile(name: string, source: ManifestSource): Promise<InterfaceData>;
  new (ctx: InterfaceContext): InterfaceHandler;
}

export abstract class Interface implements InterfaceHandler {
  constructor(protected readonly ctx: InterfaceContext) {}

  async handleEmpty(): Promise<void> {
    this.showHelp();
  }

  validate(): string | null { return null; }

  abstract execute(): Promise<void>;

  showHelp(): void {
    const { manifest, extensionName, parsed, multi } = this.ctx;
    const implicitMethodFilter =
      parsed.methodFilter || (parsed.explicitMethod ? parsed.method : undefined);
    showApiHelp(
      manifest,
      extensionName,
      parsed.segments,
      parsed.filter,
      implicitMethodFilter,
      parsed.all,
      multi,
    );
  }
}
