import {
  compileApiInterface,
  compileGraphqlInterface,
  compileMcpInterface,
} from './spec.js';
import { ApiInterface, GraphqlInterface, McpInterface } from './interfaces.js';
import { registerInterfaceProvider } from './interface-provider.js';

registerInterfaceProvider('api', {
  usage: ' <method> <resource> [id] [flags]',
  compile: compileApiInterface,
  create: (ctx) => new ApiInterface(ctx),
});

registerInterfaceProvider('graphql', {
  usage: ' <query> [flags]',
  compile: compileGraphqlInterface,
  create: (ctx) => new GraphqlInterface(ctx),
});

registerInterfaceProvider('mcp', {
  usage: ' <tool> [args]',
  compile: compileMcpInterface,
  create: (ctx) => new McpInterface(ctx),
});
