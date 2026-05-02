# godmode

## 0.0.3

### Patch Changes

- ccbc542: Per-project extensions with a `.godmode/` overlay. `godmode ext install stripe` now writes to `<cwd>/.godmode/extensions/` by default; `-g` / `--global` targets `~/.godmode/` (npm-style). Extension lookup walks upward from cwd, falling back to the global install. Writes lazily create the directory and seed a `.gitignore` for runtime artifacts. `GODMODE_EXTENSIONS_DIR` and the Linux `XDG_CONFIG_HOME` branch are removed — the dual-scope resolver subsumes both.

  Extension permissions via `settings.yaml` (project overlay on top of global). IAM-inspired allow/deny rules with segment-aware resource globs:

  ```yaml
  extensions:
    stripe:
      permissions:
        allow:
          - resources: [customers.*, charges]
            methods: [GET, POST]
        deny:
          - resources: [account]
  ```

  Default-deny when a block exists, default-allow when one doesn't (opt-in). Deny always wins. Enforced before dispatch for every interface (API, GraphQL, MCP) — blocked calls exit non-zero without touching the network.

  Internal: `Interface` base class with `ApiInterface` / `GraphqlInterface` / `McpInterface` subclasses collapses ~140 lines of dispatcher branching into a 25-line factory. `AuthStrategy` base class with `BearerAuth` / `ApiKeyAuth` / `BasicAuth` replaces three duplicated switches across the interface packages. `GODMODE_VERBOSE` env var renamed to `GODMODE_DEBUG` to match its actual behavior (logs the HTTP exchange without skipping the request).

## 0.0.2

### Patch Changes

- 5e4b2fb: Require an explicit HTTP method for `api` interface calls. The method is the first positional after the interface keyword (case-insensitive): `godmode stripe api GET customers cus_123`. The short/long flag forms (`-g`, `-po`, `-pu`, `-pa`, `-d`, `--head`, and their `--get`/`--post`/etc. variants) are removed, and the implicit "body fields → POST" inference is gone. Calls that previously relied on either now error with `Missing HTTP method`. GraphQL and MCP interfaces are unaffected.

  Rename `~/.godmode/apis/` to `~/.godmode/extensions/`. Existing installs are migrated automatically on first command run. Override the location via the `GODMODE_EXTENSIONS_DIR` env var.

  Extract the `HelpPage` class and help primitives into a new `@godmode-cli/cli` workspace package. Breaks a turbo build cycle between `godmode` and `@godmode-cli/command-agent`. Back-compat `godmode/help` subpath is preserved.

  Add a harness-agnostic `godmode agent` workflow powered by native coding CLIs (Claude, Codex, Gemini) with persistent zmx sessions, structured per-turn output capture, normalized events, resume/continue support, and project/global settings for harness, model, and effort.

  Add `@godmode-cli/test` for adapter test harnesses and `@godmode-cli/coding-agents` for agent integration primitives.

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
