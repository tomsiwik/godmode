import { interfaceRegistry } from './interface-registry.js';
import { ApiInterface } from './interfaces/api.js';
import { GraphqlInterface } from './interfaces/graphql.js';
import { McpInterface } from './interfaces/mcp.js';

for (const InterfaceType of [ApiInterface, GraphqlInterface, McpInterface]) {
  interfaceRegistry.register(InterfaceType);
}
