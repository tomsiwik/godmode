# godmode

Any API as CLI. Any API as MCP. No-clip limitless powers.

## What is godmode?

godmode turns any OpenAPI, GraphQL, or MCP spec into a CLI command and an MCP server — with zero code generation. Register once, use from the terminal or from Claude Code.

## Architecture

```
            OpenAPI / GraphQL / MCP spec
                       |
                    godmode
                   /       \
                 CLI       MCP
            (terminal)  (Claude Code)
```

## Two kinds of adapters

### Spec-based (API, GraphQL, MCP)

A `manifest.yaml` pointing to a remote spec. No runtime code needed.

```yaml
slug: stripe
name: Stripe
type: api
spec: https://raw.githubusercontent.com/stripe/openapi/.../openapi.spec3.yaml
url: https://api.stripe.com
auth:
  env: STRIPE_API_KEY
```

```sh
godmode add stripe          # register
godmode stripe customers    # CLI
godmode mcp stripe          # MCP server
```

### Package-based (custom adapters)

An npm package with a `.mcp.json` and its own MCP server implementation. Installed to `~/.godmode/node_modules/`.

```sh
godmode add claude-code-channels   # installs package
godmode mcp claude-code-channels   # spawns MCP server from .mcp.json
```

The `.mcp.json` declares how to run it:

```json
{
  "mcpServers": {
    "claude-code-channels": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/channels.js"]
    }
  }
}
```

## Key commands

```sh
godmode add <name|folder>     # Register adapter (spec or package)
godmode <name> <resource>     # CLI mode
godmode mcp <name>            # MCP server mode (stdio)
godmode list                  # Show registered adapters
godmode remove <name>         # Unregister
godmode create                # Interactive wizard
```

## Monorepo structure

```
packages/
  cli/         @godmode-cli/godmode       # Core CLI + generic MCP adapter
  ui/          @godmode-cli/ui        # UI components
adapters/
  stripe/      @godmode-cli/stripe    # Spec-based adapters
  github/      @godmode-cli/github
  claude-code-channels/               # Package-based adapter
apps/
  web/                                # Web dashboard
  docs/                               # Documentation
```

## Storage

- `~/.godmode/apis/` — parsed manifests for spec-based adapters
- `~/.godmode/node_modules/` — installed package-based adapters
