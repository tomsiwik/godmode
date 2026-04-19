---
"godmode": patch
---

Require an explicit HTTP method for `api` interface calls. The method is the first positional after the interface keyword (case-insensitive): `godmode stripe api GET customers cus_123`. The short/long flag forms (`-g`, `-po`, `-pu`, `-pa`, `-d`, `--head`, and their `--get`/`--post`/etc. variants) are removed, and the implicit "body fields → POST" inference is gone. Calls that previously relied on either now error with `Missing HTTP method`. GraphQL and MCP interfaces are unaffected.

Rename `~/.godmode/apis/` to `~/.godmode/extensions/`. Existing installs are migrated automatically on first command run. Override the location via the `GODMODE_EXTENSIONS_DIR` env var.

Extract the `HelpPage` class and help primitives into a new `@godmode-cli/cli` workspace package. Breaks a turbo build cycle between `godmode` and `@godmode-cli/command-agent`. Back-compat `godmode/help` subpath is preserved.

Add a harness-agnostic `godmode agent` workflow powered by native coding CLIs (Claude, Codex, Gemini) with persistent zmx sessions, structured per-turn output capture, normalized events, resume/continue support, and project/global settings for harness, model, and effort.

Add `@godmode-cli/test` for adapter test harnesses and `@godmode-cli/coding-agents` for agent integration primitives.
