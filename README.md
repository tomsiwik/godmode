<p align="center">
  <img src="assets/logo.svg?sanitize=1" alt="godmode" width="100" height="100" />
</p>

<h2 align="center">Godmode</h2>

<p align="center">
  any API as CLI. any API as MCP. zero code generation.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@godmode-cli/godmode"><img src="https://img.shields.io/npm/v/@godmode-cli/godmode?style=flat-square&color=blue" alt="npm" /></a>
  <a href="https://github.com/tomsiwik/godmode/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT" /></a>
</p>

<p align="center">
  <a href="https://docs.godmode.so">Documentation</a> &middot; <a href="https://godmode.so/adapters">Adapters</a>
</p>

---

## Install

```sh
npm install -g @godmode-cli/godmode
```

## Usage

Register an API, use it from the terminal or serve it as MCP tools for Claude Code.

```sh
godmode add stripe
godmode stripe customers cus_123
godmode mcp stripe
```

That's it. 5 lines of YAML, 616 routes.

## Adapters

Godmode ships with built-in adapters. Add your own by pointing at any folder with a `manifest.yaml`.

```sh
godmode add ./my-adapter
```

```yaml
# manifest.yaml
slug: my-adapter
name: My Adapter
type: api                              # api | graphql | mcp
spec: https://example.com/openapi.json
url: https://api.example.com
auth:
  env: MY_API_KEY
```

| Adapter | Type | Routes |
|---------|------|--------|
| Stripe | api | 616 |
| GitHub | api | 1,093 |
| OpenAI | api | 148 |
| Slack | api | 174 |
| Context7 | mcp | 2 |
| Claude Code Channels | mcp | 6 |

## MCP

Every registered API doubles as an MCP server over stdio.

```json
{
  "mcpServers": {
    "stripe": {
      "command": "godmode",
      "args": ["mcp", "stripe"]
    }
  }
}
```

## CLI

```sh
godmode stripe customers                       # List
godmode stripe customers cus_123               # Get
godmode stripe customers --post email=a@b.com  # Create
godmode stripe customers cus_123 -d            # Delete
godmode stripe --help                          # Explore
```

## GraphQL

Same flow — point at a schema or introspection endpoint.

```yaml
slug: my-gql
name: My GraphQL API
type: graphql
spec: https://example.com/schema.graphql       # SDL file or introspection URL
url: https://api.example.com/graphql
auth:
  env: MY_API_KEY
```

```sh
godmode add ./my-gql
godmode my-gql listUsers                       # Run a query
godmode mcp my-gql                             # Serve as MCP
```

