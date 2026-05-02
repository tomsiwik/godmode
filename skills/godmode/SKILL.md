---
name: godmode
description: Use the godmode CLI to invoke any third-party API, GraphQL endpoint, or MCP server from the terminal with one grammar — `godmode <extension> <interface> <args>`. Triggers when the user wants to call services like Stripe, GitHub, Slack, OpenAI, or any OpenAPI/GraphQL/MCP backend without writing client code; install or discover extensions; expose an extension as an MCP server for Claude Code, Cursor, or another MCP client; or scope an agent's outbound tool access through a single `Bash(godmode:*)` permission. Covers the install/discovery/invocation loop and points at extension-specific skills when present.
---

# godmode

godmode is a single-command CLI for any API, GraphQL endpoint, or MCP server. One invocation grammar, one Bash permission.

## When to reach for it

- The user asks to call **Stripe / GitHub / Slack / OpenAI / Context7 / petstore / any third-party API** from a script or agent.
- The user wants to **expose a backend as an MCP server** for Claude Code, Cursor, etc.
- An agent in a sandbox needs **scoped tool access** — granting `Bash(godmode:*)` is enough; godmode enforces per-extension allow/deny.
- The user mentions **OpenAPI, GraphQL, or MCP** alongside "from the terminal" or "as a tool".

If the user is **not** trying to call a remote service (purely local file work, framework code, etc.) — this skill does not apply.

## Grammar

```
godmode <extension> <interface> [args...]
```

- `<extension>` — anything installed via `godmode ext install`, plus the built-ins `ext` and `agent`.
- `<interface>` — `api`, `graphql`, or `mcp`.
- `[args...]` — interface-specific. For `api`, follows [httpie](https://httpie.io/docs/cli/request-items) conventions: `key=value` → JSON body, `key==value` → query, `-H 'X:y'` → header.

## The three commands you'll use 95% of the time

```sh
godmode ext install <name>          # install an extension (npm name or built-in slug)
godmode <name> --help               # discover what the extension exposes
godmode <name> <interface> <args>   # invoke
```

`--help` works at every nesting level (`godmode <ext> <iface> <resource> --help`) and always lists exactly what's available at that scope. **Always run `--help` at the deepest known level before invoking** — it's the source of truth for resources, methods, query params, and required env vars.

## Worked example

```sh
godmode ext install stripe                                  # one-time
godmode stripe --help                                       # see auth env var, interfaces
godmode stripe api customers --help                         # see operations
godmode stripe api GET customers cus_123                    # GET /v1/customers/cus_123
godmode stripe api POST customers email=a@b.com             # POST with body
godmode stripe api GET customers limit==10                  # ?limit=10
godmode stripe mcp                                          # serve as MCP over stdio
```

## Authentication

Each extension declares its own env var. `godmode <ext> --help` prints the exact name. Set it in the shell or in a `.env` in the current working directory (godmode auto-loads cwd `.env`, no walking, no expansion).

## Extension-specific skills

Some extensions ship their own skill alongside the binding (e.g. a `godmode-stripe` skill that knows Stripe-specific resources and gotchas). When the user mentions a specific service, **check `.claude/skills/` for `godmode-<service>`** — if present, prefer it for service-specific guidance. This skill stays domain-agnostic.

## Common pitfalls

- **"Command not found"** after install — extensions are subcommands of `godmode`, not standalone binaries. Run `godmode <slug>`, not `<slug>`.
- **Auth env var not picked up** — godmode only reads `.env` from cwd, never walks up. Shell-exported env wins.
- **Wrong arg shape** — `key=value` is body, `key==value` is query. Mixing them silently sends the wrong request.
- **Method missing on `api`** — first positional after `api` is the HTTP verb (`GET`/`POST`/...), required and case-insensitive.

## More

For the full CLI reference, manifest schema, and per-interface details, see [references/godmode.md](references/godmode.md).
