---
"godmode": patch
---

Require an explicit HTTP method for `api` interface calls.

The method is now the first positional argument after the interface keyword (case-insensitive): `godmode stripe api GET customers cus_123`. The short/long flag forms (`-g`, `-po`, `-pu`, `-pa`, `-d`, `--head`, and their `--get`/`--post`/etc. variants) are removed, and the implicit "body fields → POST" inference is gone. Calls that previously relied on either will now error with `Missing HTTP method`. GraphQL and MCP interfaces are unaffected.

Internal: the `HelpPage` class and related render primitives moved to the new `@godmode-cli/cli` workspace package (breaks a turbo build cycle with `@godmode-cli/command-agent`). The `~/.godmode/apis/` directory is now `~/.godmode/extensions/` with an automatic one-time migration on first command run; override via the `GODMODE_EXTENSIONS_DIR` env var.
