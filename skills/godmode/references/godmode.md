# godmode CLI Reference

## Manifest format

```yaml
# manifest.yaml
slug: <name>                    # CLI name (godmode <slug>)
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

Package-based adapters omit `type`, `spec`, and `url`. They provide a `.mcp.json` instead.

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
# Setup
godmode add <name>              # Built-in adapter by name
godmode add <folder>            # Folder with manifest.yaml
godmode create                  # Interactive wizard
godmode update <name>           # Re-fetch spec
godmode remove <name>           # Unregister
godmode list                    # Show all registered

# API interaction (httpie-style)
godmode <api> <resource>                  # GET (list)
godmode <api> <resource> <id>             # GET (detail)
godmode <api> <resource> --post key=val   # POST
godmode <api> <resource> <id> -d          # DELETE
godmode <api> <resource> key==val         # Query param
godmode <api> /raw/path                   # Raw path mode

# MCP server
godmode mcp <name>              # Serve as MCP over stdio

# Navigation
godmode <api> --help            # Resources, auth
godmode <api> <resource> --help # Operations, sub-resources
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

`godmode add <input>`:

1. `<input>/manifest.yaml` in current directory
2. `adapters/<input>/manifest.yaml` in godmode install
3. `npm install @godmode-cli/<input> --prefix ~/.godmode/`

## MCP server resolution

`godmode mcp <name>`:

1. Check `~/.godmode/node_modules/@godmode-cli/<name>/.mcp.json` → spawn from config
2. Fallback: load manifest from `~/.godmode/apis/<name>.json` → generic MCP adapter

## Built-in adapters

| Adapter | Type | Slug |
|---------|------|------|
| Stripe | api | `stripe` |
| GitHub | api | `github` |
| OpenAI | api | `openai` |
| Slack | api | `slack` |
| Petstore | api | `petstore` |
| Context7 | mcp | `context7` |
| Claude Code Channels | package | `claude-code-channels` |
