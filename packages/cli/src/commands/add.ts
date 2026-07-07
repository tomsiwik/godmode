import { addApi, type Scope } from '../config.js';

export async function runAdd(args: string[], scope: Scope = 'project') {
  if (!args[0] || args[0] === '--help' || args[0] === '-h') {
    console.log(`Add an extension from a folder, built-in name, or manifest.

Usage:
  godmode ext install <name>            Built-in extension (e.g. stripe, github)
  godmode ext install <folder>          Folder containing manifest.yaml
  godmode ext install <manifest>        Direct path to manifest.yaml/json

Manifest format (manifest.yaml):
  slug:    stripe             CLI name
  name:    Stripe             Display name
  description: Payments API   Short description
  type:    api                api | graphql | mcp
  spec:    <url>              OpenAPI spec URL or local file (api, graphql)
  url:     <base-url>         API base URL (api, graphql) or MCP endpoint (mcp)
  auth:
    env:   STRIPE_API_KEY     Environment variable for auth token
    type:  bearer             Auth type (bearer, api-key, basic)
  headers:
    X-Custom: value           Default headers for every request

Types:
  api                         OpenAPI spec  (requires spec + url)
  graphql                     GraphQL       (requires spec or url)
  mcp                         MCP endpoint  (requires url)

Examples:
  $ godmode ext install stripe
  $ godmode ext install ./my-extension
  $ godmode ext install ./my-extension/manifest.yaml
  $ godmode ext install openai`);
    process.exit(args[0] ? 0 : 1);
  }
  await addApi(args[0], scope);
}
