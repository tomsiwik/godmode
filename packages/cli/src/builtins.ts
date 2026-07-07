/** Core extensions bundled with godmode. A slug is occupied the moment its
 *  extension is registered — built-ins register by shipping with the CLI,
 *  everything else via `godmode ext install`. Handlers are lazy-imported so
 *  this module stays dependency-free and safe to import from anywhere. */
export interface Builtin {
  description: string;
  run(rest: string[]): Promise<void>;
}

export const BUILTINS: ReadonlyMap<string, Builtin> = new Map<string, Builtin>([
  ['ext', {
    description: 'Install and manage godmode extensions',
    run: async (rest) => (await import('./commands/ext.js')).runExt(rest),
  }],
  ['agent', {
    description: 'Coding-agent workflows',
    run: async (rest) => {
      const { runAgentCommand } = await import('@godmode-cli/command-agent');
      const code = await runAgentCommand(rest);
      if (code !== 0) process.exit(code);
    },
  }],
  ['permissions', {
    description: 'Inspect godmode permission policy',
    run: async (rest) => (await import('./commands/permissions.js')).runPermissions(rest),
  }],
]);
