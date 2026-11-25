import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/cli',
      'commands/agent',
      'packages/cli-tools',
      'packages/test',
      'interfaces/api',
      'interfaces/graphql',
      'interfaces/mcp',
    ],
  },
});
