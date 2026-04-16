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

## Two kinds of extensions

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
godmode extension add stripe          # register
godmode api stripe customers          # CLI
godmode mcp stripe                    # MCP server
```

### Package-based (custom extensions)

An npm package with a `.mcp.json` and its own MCP server implementation. Installed to `~/.godmode/node_modules/`.

```sh
godmode extension add claude-code-channels   # installs package
godmode mcp claude-code-channels             # spawns MCP server from .mcp.json
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
godmode extension add <name|folder>   # Register extension (spec or package)
godmode extension remove <name>       # Unregister
godmode extension list                # Show registered extensions
godmode extension update <name>       # Re-fetch spec, rebuild
godmode extension info <name>         # Show details + available interfaces
godmode extension create              # Interactive wizard

godmode api <name> <resource>         # REST interface
godmode graphql <name> <query>        # GraphQL interface
godmode mcp <name>                    # MCP server interface (stdio)
godmode agent <name>                  # Agent command (requires command-agent)
godmode skill <name>                  # Load agentic skill
```

## Monorepo structure

```
packages/
  cli/                  godmode                       # Core CLI dispatch
  test/                  @godmode-cli/test             # Test utilities
  ui/                   @godmode-cli/ui               # UI components
interfaces/
  api/                  @godmode-cli/interface-api     # REST execution
  graphql/              @godmode-cli/interface-graphql # GraphQL execution
  mcp/                  @godmode-cli/interface-mcp     # MCP server wrapping
commands/
  agent/                @godmode-cli/command-agent     # Coding agent orchestration
extensions/
  stripe/               @godmode-cli/stripe           # Spec-based extensions
  github/               @godmode-cli/github
  claude-code-channels/                               # Package-based extension
apps/
  web/                                                # Web dashboard
  docs/                                               # Documentation
```

## Storage

- `~/.godmode/apis/` — parsed manifests for spec-based extensions
- `~/.godmode/node_modules/` — installed package-based extensions
