<p align="center">
  <img src="assets/logo.svg?sanitize=1" alt="godmode" width="100" height="100" />
</p>

<h2 align="center">Godmode</h2>

<p align="center">
  any API as CLI. any API as MCP. no-clip limitless powers.
</p>

<p align="center">
  <a href="https://img.shields.io/badge/node-20+-green?style=flat-square&logo=node.js&logoColor=white"><img src="https://img.shields.io/badge/node-20+-green?style=flat-square&logo=node.js&logoColor=white" alt="Node" /></a>
</p>

<p align="center">
  <a href="https://github.com/tomsiwik/godmode/issues">Issues</a>
</p>

## Introduction

Turn any API into a CLI **and** an MCP server. 5 lines of YAML, zero code generation.

Register once, use from the terminal **or** from Claude Code (or any MCP client).

```
            OpenAPI / GraphQL / MCP spec
                       |
                    godmode
                   /       \
                 CLI       MCP
            (terminal)  (Claude Code)
```

```sh
# CLI
godmode stripe customers cus_123

# MCP — serve Stripe as tools for Claude Code
godmode mcp stripe
```

## Quick Start

```sh
npm install -g godmode
```

Add a built-in adapter:

```sh
godmode add stripe
godmode stripe --help
```

Or point at any folder with a `manifest.yaml`:

```sh
godmode add ./my-adapter
```

Or use the interactive wizard:

```sh
godmode create
```

### Manifest format

```yaml
# manifest.yaml
slug: my-adapter
name: My Adapter
type: api
spec: https://example.com/openapi.json
url: https://api.example.com
auth:
  env: MY_API_KEY
```

## As CLI

```sh
godmode stripe customers                     # List
godmode stripe customers cus_123             # Get
godmode stripe customers --post email=a@b.com  # Create
godmode stripe customers cus_123 -d          # Delete
godmode stripe /v1/customers                 # Raw path
```

Navigate with `--help` at any level:

```sh
godmode stripe --help                        # Resources, auth, usage
godmode stripe customers --help              # Operations & sub-resources
```

## As MCP Server

Serve any registered API as an MCP server over stdio:

```sh
godmode mcp stripe
godmode mcp github
godmode mcp openai
```

Connect from Claude Code via `.mcp.json`:

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

Every route becomes an MCP tool. Claude Code can now call your APIs directly.

## Claude Code Channels

Built-in inter-session messaging for Claude Code instances:

```sh
godmode add claude-code-channels
godmode claude-code-channels list_peers
godmode claude-code-channels send text="hello" to_session="abc123"
```

As an MCP channel server for Claude Code:

```json
{
  "mcpServers": {
    "channels": {
      "command": "godmode",
      "args": ["mcp", "claude-code-channels"]
    }
  }
}
```

Claude Code instances can now send messages, broadcast, and schedule recurring messages to each other.

## Adapters

Built-in adapters in `adapters/`:

| Adapter | Type | Routes | Auth |
|---------|------|--------|------|
| Stripe | API | 616 | Bearer |
| GitHub | API | 1,093 | Bearer |
| OpenAI | API | 148 | Bearer |
| Slack | API | 174 | Bearer |
| Petstore | API | 19 | None |
| Context7 | MCP | 2 | API Key |
| Claude Code Channels | Channels | 6 | None |

### Supported Types

| Type | Source | CLI | MCP |
|------|--------|-----|-----|
| `api` | OpenAPI spec | `godmode <name> <resource>` | `godmode mcp <name>` |
| `graphql` | Introspection / SDL | `godmode <name> <query>` | `godmode mcp <name>` |
| `mcp` | MCP endpoint | `godmode <name> <tool>` | `godmode mcp <name>` |
| `channels` | Local filesystem | `godmode <name> <tool>` | `godmode mcp <name>` |

## Project Structure

```
godmode/
  packages/
    cli/                @godmode-cli/godmode       # Core CLI
    ui/                 @godmode-cli/ui        # UI components
  adapters/
    stripe/             @godmode-cli/stripe    # Adapter packages
    github/             @godmode-cli/github
    openai/             @godmode-cli/openai
    claude-code-channels/  @godmode-cli/claude-code-channels
    ...
  apps/
    web/                                       # Web dashboard
    docs/                                      # Documentation
```

## Development

```sh
pnpm install
pnpm build
pnpm test
```

### Adding a new adapter

```sh
mkdir adapters/myapi
```

```yaml
# adapters/myapi/manifest.yaml
slug: myapi
name: My API
type: api
spec: https://example.com/openapi.json
url: https://api.example.com
```

```sh
godmode add adapters/myapi
godmode myapi --help
godmode mcp myapi  # also works as MCP
```

## Reference

```
Usage:
  godmode <api> <resource> [id] [flags]
  godmode <api> /path [flags]

Setup:
  create                      Interactive config wizard
  add <name|file>             Register API from manifest
  update <name>               Re-fetch spec and rebuild
  remove <name>               Unregister an API
  list                        Show all registered APIs
  mcp <name>                  Serve as MCP server (stdio)

Data (httpie-style):
  key=value                   Body field (JSON, implies POST)
  key==value                  Query param (URL)

Flags:
  -po, --post                 POST
  -pu, --put                  PUT
  -pa, --patch                PATCH
  -d,  --delete               DELETE
  -H   <key:value>            Add header
       --token <tok>           Auth token (overrides config)
       --dry-run               Preview without sending
  -v,  --verbose               Full request/response
```

## Contributing

Contributions of all sizes are welcome.

<a href="https://github.com/tomsiwik/godmode/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tomsiwik/godmode" />
</a>

## License

[MIT](./LICENSE)

<br />

<p align="center">Made with &#x2764;&#xFE0F; by <a href="https://github.com/tomsiwik">tomsiwik</a></p>
