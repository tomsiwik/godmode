import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/cli',
  'commands/agent',
  'packages/cli-tools',
  'packages/test',
  'interfaces/api',
  'interfaces/graphql',
  'interfaces/mcp',
]);
