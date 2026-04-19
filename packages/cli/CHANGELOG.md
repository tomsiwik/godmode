# godmode

## 0.1.1

### Patch Changes

- 2ee8a25: Require an explicit HTTP method for `api` interface calls.

  The method is now the first positional argument after the interface keyword (case-insensitive): `godmode stripe api GET customers cus_123`. The short/long flag forms (`-g`, `-po`, `-pu`, `-pa`, `-d`, `--head`, and their `--get`/`--post`/etc. variants) are removed, and the implicit "body fields → POST" inference is gone. Calls that previously relied on either will now error with `Missing HTTP method`. GraphQL and MCP interfaces are unaffected.

  Internal: the `HelpPage` class and related render primitives moved to the new `@godmode-cli/cli` workspace package (breaks a turbo build cycle with `@godmode-cli/command-agent`). The `~/.godmode/apis/` directory is now `~/.godmode/extensions/` with an automatic one-time migration on first command run; override via the `GODMODE_EXTENSIONS_DIR` env var.

## 0.1.0

### Minor Changes

- d1c866a: Require an explicit HTTP method for `api` interface calls.

  The method is now the first positional argument after the interface keyword (case-insensitive): `godmode stripe api GET customers cus_123`. The short/long flag forms (`-g`, `-po`, `-pu`, `-pa`, `-d`, `--head`, and their `--get`/`--post`/etc. variants) are removed, and the implicit "body fields → POST" inference is gone. Calls that previously relied on either will now error with `Missing HTTP method`. GraphQL and MCP interfaces are unaffected.

  Internal: the `HelpPage` class and related render primitives moved to the new `@godmode-cli/cli` workspace package (breaks a turbo build cycle with `@godmode-cli/command-agent`). The `~/.godmode/apis/` directory is now `~/.godmode/extensions/` with an automatic one-time migration on first command run; override via the `GODMODE_EXTENSIONS_DIR` env var.

## 0.0.3

### Patch Changes

- e97e933: adds @godmode-cli/test & @godmode-cli/coding-agents

## 0.0.2

### Patch Changes

- Add a harness-agnostic `godmode agent` workflow powered by native coding CLIs with persistent zmx sessions, structured per-turn output capture, normalized events, resume/continue support, and project/global settings for harness, model, and effort.

## 0.0.1

### Initial Release

- Register APIs from YAML config (`godmode add`)
- Interactive wizard (`godmode create`)
- CRUD via flags: `-q` for params, `-d` for delete, `--post` for create
- Navigate with `--help` at any level
- Raw path mode (`godmode stripe /v1/customers`)
- Version-transparent routing (auto-detects `/v1`, `/v2` prefixes)
- Auth via `.env` with configurable env var names
- Adapters: Stripe, GitHub, OpenAI, Slack, Petstore
