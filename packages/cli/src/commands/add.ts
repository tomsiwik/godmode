import { addApi } from '../config.js';

export async function runAdd(args: string[]) {
  if (!args[0] || args[0] === '--help' || args[0] === '-h') {
    console.log(`Add an adapter from a folder, built-in name, or manifest.

Usage:
  godmode add <name>          Built-in adapter (e.g. stripe, github)
  godmode add <folder>        Folder containing manifest.yaml

Manifest format (manifest.yaml):
  slug:    stripe             CLI name (used as "godmode <slug>")
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
  $ godmode add stripe
  $ godmode add ./my-adapter
  $ godmode add openai`);
    process.exit(args[0] ? 0 : 1);
  }
  await addApi(args[0]);
}
