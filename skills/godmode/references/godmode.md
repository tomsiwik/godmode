# godmode CLI Reference

## Manifest format

```yaml
# manifest.yaml
slug: <name>                    # CLI name
name: <display-name>            # Display name
description: <text>             # Short description
type: api | graphql | mcp       # Protocol type
spec: <url|path>                # Spec URL or file (api, graphql)
url: <base-url>                 # API base URL or MCP endpoint
auth:
  env: <ENV_VAR>                # Environment variable for token
  type: bearer | api-key | basic
  header: <header-name>        # Custom header (api-key only)
headers:
  <key>: <value>                # Default headers
```

Package-based extensions omit `type`, `spec`, and `url`. They provide a `.mcp.json` instead.

## .mcp.json format

Standard MCP server configuration, following the Claude Code convention:

```json
{
  "mcpServers": {
    "<server-name>": {
      "type": "stdio",
      "command": "<executable>",
      "args": ["<arg1>", "<arg2>"],
      "env": { "<KEY>": "<value>" }
    }
  }
}
```

## CLI usage

```sh
# Extension management
godmode extension add <name>              # Built-in extension by name
godmode extension add <folder>            # Folder with manifest.yaml
godmode extension create                  # Interactive wizard
godmode extension update <name>           # Re-fetch spec
godmode extension remove <name>           # Unregister
godmode extension list                    # Show all registered
godmode extension info <name>             # Show details + interfaces

# API interface (httpie-style)
godmode api <ext> <resource>              # GET (list)
godmode api <ext> <resource> <id>         # GET (detail)
godmode api <ext> <resource> --post key=val  # POST
godmode api <ext> <resource> <id> -d      # DELETE
godmode api <ext> <resource> key==val     # Query param
godmode api <ext> /raw/path               # Raw path mode

# GraphQL interface
godmode graphql <ext> query '{ ... }'     # Query

# MCP interface
godmode mcp <ext>                         # Serve as MCP over stdio

# Navigation
godmode api <ext> --help                  # Resources, auth
godmode api <ext> <resource> --help       # Operations, sub-resources
```

## Method flags

| Flag | Method |
|------|--------|
| `-g`, `--get` | GET (default) |
| `-po`, `--post` | POST |
| `-pu`, `--put` | PUT |
| `-pa`, `--patch` | PATCH |
| `-d`, `--delete` | DELETE |

## Options

| Flag | Description |
|------|-------------|
| `-H <key:value>` | Add header |
| `--token <tok>` | Override auth token |
| `--dry-run` | Preview without sending |
| `-v`, `--verbose` | Full request/response |
| `--filter <text>` | Filter resources |
| `--method <method>` | Filter by HTTP method |
| `--all` | Show all resources |

## Config resolution order

`godmode extension add <input>`:

1. `<input>/manifest.yaml` in current directory
2. `extensions/<input>/manifest.yaml` in godmode install
3. `npm install @godmode-cli/<input> --prefix ~/.godmode/`

## MCP server resolution

`godmode mcp <name>`:

1. Check `~/.godmode/node_modules/@godmode-cli/<name>/.mcp.json` → spawn from config
2. Fallback: load manifest from `~/.godmode/apis/<name>.json` → generic MCP server

## Built-in extensions

| Extension | Type | Name |
|-----------|------|------|
| Stripe | api | `stripe` |
| GitHub | graphql | `github` |
| OpenAI | api | `openai` |
| Slack | api | `slack` |
| Petstore | api | `petstore` |
| Context7 | mcp | `context7` |
| Claude Code Channels | package | `claude-code-channels` |
