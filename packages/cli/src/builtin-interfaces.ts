import { interfaceRegistry } from './interface-registry.js';
import { ApiInterface } from './interfaces/api.js';
import { CommandInterface } from './interfaces/command.js';
import { GraphqlInterface } from './interfaces/graphql.js';
import { McpInterface } from './interfaces/mcp.js';

for (const InterfaceType of [ApiInterface, GraphqlInterface, McpInterface, CommandInterface]) {
  interfaceRegistry.register(InterfaceType);
}
