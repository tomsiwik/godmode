# godmode — internal research notes (input for epic PRDs)

> Working document. Not a PRD. Condensed findings from a codebase + product analysis (2026-07-05).

## Vision

godmode is the Swiss Army knife CLI for coding agents: one invocation grammar
(`godmode [extension] [interface] [args]`) wraps APIs, GraphQL, MCP servers, and local
commands as installable extensions. A sandboxed agent needs a single permission —
`Bash(godmode:*)` — to reach its whole toolbelt, and godmode's own permission layer scopes
what is reachable inside that. Target end-state: **one CLI harness does it all** — tools,
agent orchestration, scripts, workflows, and a unified searchable history of all
agent dialogue, serving both daily engineering and harness research.

## What exists today (ground truth)

- **Dispatch** (`packages/cli/src/index.ts`): `godmode <ext> <interface> [args]`; interfaces
  `api|graphql|mcp|skill` (skill = stub that errors); built-ins/reserved: `ext`, `agent`.
- **Extensions**: declarative `manifest.yaml` compiled at install time into
  `~/.godmode/extensions/<slug>.json` (or project `.godmode/extensions/`, which shadows
  global). Schema: `packages/cli/schemas/manifest.schema.json`. Shipped: stripe, openai,
  slack (OpenAPI), github (GraphQL), context7 (remote MCP), petstore (demo),
  claude-code-channels (package-based stdio MCP server for inter-Claude-session messaging).
- **Interfaces as packages**: `interfaces/api` (mature), `interfaces/graphql` (thin,
  regex SDL parser), `interfaces/mcp` (client + server — any extension can be re-served
  as an MCP stdio server; distinctive bidirectional primitive).
- **Permissions** (`packages/cli/src/permissions.ts`, `settings.ts`): IAM-style allow/deny
  statements in `settings.yaml` (global `~/.godmode/` + project `.godmode/` overlay),
  default-deny once a block exists, deny wins, segment-aware resource globs. Genuinely
  enforced at dispatch — with two bypass gaps (below).
- **`godmode agent`** (`commands/agent/`): multi-harness turn executor for
  claude/codex/gemini/pi. Normalizes each harness's stream-json into a common
  `NormalizedEvent` vocabulary (`turn.started`, `assistant.delta`, `assistant.completed`,
  `turn.completed`, `warning`) with usage/timing. Durable run/turn store under
  `~/.godmode/coding-agents/runs/<id>/turns/NNNN/` (stdout/stderr logs, events.jsonl,
  normalized.json), active-run-per-cwd map, per-harness session resume tokens. Verbs:
  start/send/attach/output/status/list; output modes `--json|--assistant-text|--events|--raw`,
  `--follow`. Hard dependency on external `zmx`; execution blocks synchronously per turn.
- **State today**: ad-hoc JSON files. No SQLite. No request/response history, no
  invocation logging, no telemetry.
- **Two settings systems**: permissions in `settings.yaml`, agent defaults in
  `settings.json` (`plugins.coding-agents`).

## Load-bearing abstractions to build on

1. `MultiManifest`/`Route` — everything (OpenAPI paths, GraphQL fields, MCP tools)
   normalizes into one route model powering matching, help, permissions, MCP serving.
2. `checkPermission` + settings overlay — the policy engine.
3. `HarnessAdapter` + `NormalizedEvent` — uniform turn protocol over agent CLIs. This is
   the seed of: the standardized dialogue format (history epic), the streaming format
   (orchestration epic), and the trace format (observability epic). Extend + version it
   before building those epics.
4. Project/global scope resolver (`.godmode/` upward walk, project shadows global).
5. `AuthStrategy` (bearer/api-key/basic) shared by all interfaces.

## Defects & gaps found (feeds Epic 01)

**Blockers**
- Raw-path escape hatch (`godmode stripe api /v1/...`) executes before `checkPermission`
  → any deny rule bypassable (`packages/cli/src/interfaces.ts:71-81`).
- MCP serve mode (`interfaces/mcp/src/server.ts`) enforces no permissions — the
  documented Claude Code setup runs fully unscoped.
- Package-based (npm) extensions are invisible to the dispatcher and `ext list`
  (`findInstalledManifestSync` only reads compiled JSON) — the whole npm
  publishing/ecosystem story is non-functional end to end
  (`publishing.mdx` documents `exports."./manifest"`, installer never reads it).
- Corrupt/unparseable `settings.yaml` fails **open** to allow-all (`settings.ts:61-71`).

**Major**
- `godmode ext create` wizard emits the legacy flat manifest format that the installer
  rejects, writes `<name>.yaml` not `manifest.yaml`, hints a dead command
  (`godmode extension add`).
- Docs drift everywhere: 6 extension pages use dead `godmode extension add`; wrong MCP
  args order in 6 pages; `agent stop` documented but not implemented; `--debug` flag
  documented, doesn't exist; XDG_CONFIG_HOME documented, not implemented in cli config;
  `skills/godmode/references/godmode.md` teaches a broken command set to agents.
- Stale shared test adapter (`packages/test/src/adapter.ts` uses removed
  `setup command` grammar); `help-compliance.test.ts` checks legacy `apis/` dir so
  assertions silently never run; vitest workspace only covers `packages/cli`.
- No non-zero exit for HTTP 4xx/5xx; no status-code surfacing without GODMODE_DEBUG —
  bad for agents scripting against exit codes.
- `ext uninstall` leaves npm-installed package dirs behind; `.mcp.json` detection assumes
  `@godmode-cli/` scope; `runMcp` package lookup ignores project scope.
- `agent`: no stop/kill; `waitForFile` can hang forever if harness dies without writing
  exit-code; codex has no stream parser and no session resume; zmx dependency
  undocumented; `--harness=x` equals-form rejected.
- GraphQL: regex SDL parser breaks on real schemas (interfaces, unions, inputs);
  zero tests; the `'{ query }'` invocation syntax is undocumented.
- MCP method dimension conflated (`method: 'mcp'`) so `methods:` rules are meaningless
  for MCP tools.
- Tool-use events are dropped from the normalized event stream (only assistant text
  captured) — blocks history/research value.
- No permissions CLI UX (list effective policy, grant/deny flow, "blocked — add rule?").

## Prior art worth learning from

- opencode: SQLite session store (first ingest target + schema reference), client/server
  split (HTTP daemon per agent = clean RPC substrate).
- Claude Code: subagents (sync parent-owned model), hooks/skills, `--resume` picker UX,
  plugin/skill scaffolds.
- MCP sampling (callee asks caller's model — inverse direction to support when godmode
  serves MCP). A2A-style agent cards for discovery.
- Temporal/LangGraph: durable execution, signals ≙ human gates, checkpointers. GitHub
  Actions YAML ergonomics. `just`/`mise` as the degenerate no-state task runner.
- OpenTelemetry GenAI semantic conventions (naming for trace events).
- Deno permission flags (future real-sandbox story for scripts).

## Cross-cutting decisions (surface in overview + relevant epics)

1. **One store**: orchestration, workflows, history, and trace all need durable local
   state. Decide once: shared SQLite at `~/.godmode/godmode.db` (recommended, opencode
   precedent) vs staying file-based. History epic owns the decision; others consume.
2. **Normalized event schema v1**: extend `NormalizedEvent` with tool calls, permission
   decisions, errors; version it. Prerequisite-ish for epics 03/06/07.
3. **Reserved built-in namespace**: `ext`, `agent` today; `extension`, `script`,
   `workflow`, `history`, `sessions`, `trace`, `auth` would join. Every reserved word is
   a slug extension authors lose — fix the list early.
4. **Agent identity/addressing**: runs use `run-<ts>-<uuid>`, channels uses PIDs, docs
   promise short slugs (`a4-fox`). One addressing model must span runs, live sessions,
   and messaging.
5. **Settings unification**: one `settings.yaml` (permissions + agent defaults + future
   workflow/script/history config).
6. **Default-deny consistency**: agent-created artifacts (extensions, scripts) should
   install project-scoped and may require human ack before becoming agent-runnable.

## Epic map

| # | File | Epic |
|---|------|------|
| 01 | 0100-foundation-hardening.md | Foundation hardening & consistency (fixes) |
| 02 | 0200-extension-authoring.md | Extension authoring & scaffolding (`godmode extension create`) |
| 03 | 0300-agent-orchestration.md | Agent orchestration & messaging (`godmode agent *`) |
| 04 | 0400-scripts.md | Scripts (`godmode script create|run`) |
| 05 | 0500-workflows.md | Workflows (`godmode workflow *`) |
| 06 | 0600-sessions-history.md | Sessions & history (`godmode history|sessions *`) |
| 07 | 0700-observability-trace.md | Observability & audit (`godmode trace`) |
| 08 | 0800-registry-trust.md | Extension registry & trust |
| 09 | 0900-auth-vault.md | Auth vault & credential brokering |
