---
"godmode": patch
---

Per-project extensions with a `.godmode/` overlay. `godmode ext install stripe` now writes to `<cwd>/.godmode/extensions/` by default; `-g` / `--global` targets `~/.godmode/` (npm-style). Extension lookup walks upward from cwd, falling back to the global install. Writes lazily create the directory and seed a `.gitignore` for runtime artifacts. `GODMODE_EXTENSIONS_DIR` and the Linux `XDG_CONFIG_HOME` branch are removed — the dual-scope resolver subsumes both.

Extension permissions via `settings.yaml` (project overlay on top of global). IAM-inspired allow/deny rules with segment-aware resource globs:

```yaml
extensions:
  stripe:
    permissions:
      allow:
        - resources: [customers.*, charges]
          methods:   [GET, POST]
      deny:
        - resources: [account]
```

Default-deny when a block exists, default-allow when one doesn't (opt-in). Deny always wins. Enforced before dispatch for every interface (API, GraphQL, MCP) — blocked calls exit non-zero without touching the network.

Internal: `Interface` base class with `ApiInterface` / `GraphqlInterface` / `McpInterface` subclasses collapses ~140 lines of dispatcher branching into a 25-line factory. `AuthStrategy` base class with `BearerAuth` / `ApiKeyAuth` / `BasicAuth` replaces three duplicated switches across the interface packages. `GODMODE_VERBOSE` env var renamed to `GODMODE_DEBUG` to match its actual behavior (logs the HTTP exchange without skipping the request).
