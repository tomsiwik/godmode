# 0100 — Foundation hardening & consistency

**Status:** Draft · **Level:** Epic · **Depends on:** —

## Summary

godmode's core promise — one grammar, one permission model, one sandbox permission — is
undermined by a handful of defects: two full permission bypasses, a settings parser that
fails open, a publishing story that doesn't work end to end, a scaffolding wizard that
emits rejected output, and documentation that teaches commands which don't exist. This
epic closes those gaps and converges the CLI, docs, and test suite onto one truthful
surface. It is the prerequisite for every other epic: authoring (0200), registry trust
(0800), and orchestration (0300) all assume the permission layer actually holds and that
what the docs say is what the binary does. Nothing here adds new capability categories;
it makes the existing ones honest, enforceable, and scriptable by agents.

## Problem / Motivation

Current state, grounded in the codebase:

- The raw-path escape hatch (`godmode stripe api /v1/charges`) executes before the
  permission check runs (`packages/cli/src/interfaces.ts:71-81`), so any deny rule is
  bypassable by phrasing the same call as a raw path.
- Serving an extension as an MCP server (`interfaces/mcp/src/server.ts`) enforces no
  permissions at all — the documented Claude Code setup runs fully unscoped.
- A corrupt or unparseable `settings.yaml` logs a warning and returns empty settings
  (`packages/cli/src/settings.ts:61-71`), which the permission engine treats as
  allow-all: the policy file failing to parse *removes* the policy.
- Package-based (npm) extensions are invisible to the dispatcher and `ext list` because
  only compiled JSON manifests are read; `publishing.mdx` documents an
  `exports."./manifest"` contract the installer never consults. The entire npm ecosystem
  story is non-functional end to end.
- `godmode ext create` emits the legacy flat manifest format the installer rejects,
  writes `<name>.yaml` instead of `manifest.yaml`, and hints the dead command
  `godmode extension add` — which six docs pages also teach (e.g.
  `apps/docs/content/extensions/github.mdx:9`).
- HTTP 4xx/5xx responses exit 0 with no status surfaced unless `GODMODE_DEBUG` is set —
  agents scripting against exit codes cannot detect failure.
- Two parallel settings systems (`settings.yaml` for permissions, `settings.json` for
  agent defaults), a stale shared test adapter using the removed `setup command`
  grammar, compliance tests asserting against a legacy `apis/` directory so they
  silently never run, and a vitest workspace covering only `packages/cli`.

## User stories

- As a team lead, I write a deny rule for `stripe` once and trust that no phrasing of
  the call — named route, raw path, or MCP tool — gets around it.
- As a developer, when my `settings.yaml` has a typo, I want godmode to refuse to run
  permissioned operations and tell me the parse error, not silently allow everything.
- As an extension author, I publish my extension to npm and a colleague installs, lists,
  and invokes it with no extra steps.
- As an agent, I check `$?` after every `godmode` call and reliably distinguish
  "succeeded", "the API returned an error", "permission denied", and "you called me
  wrong" without parsing prose.
- As a developer, I run the command a docs page shows me and it works verbatim.
- As an agent, I hit a permission denial and receive a machine-readable explanation of
  which rule blocked me and what rule would unblock me, so I can ask my human precisely.
- As a developer, I run `godmode permissions list` to see the effective merged policy
  (global + project) before letting an agent loose in a repo.
- As a researcher, I rely on the test suite to catch grammar regressions across all
  packages, not just the CLI entry point.
- As a developer, I uninstall an npm-based extension and nothing of it remains on disk
  or in listings.

## Feature description

Foundation hardening makes five behavioural guarantees:

1. **The permission layer is airtight.** Every dispatch path — named routes, raw paths,
   and every tool exposed when godmode serves an extension over MCP — passes the same
   allow/deny evaluation. Deny always wins; there is no phrasing that skips the check.
2. **Policy failures fail closed.** Unparseable or structurally invalid settings put
   godmode in a deny-all state for permissioned operations, with a clear error naming
   the file and the parse problem.
3. **The publishing loop works.** `godmode ext install <npm-name>` produces an extension
   that appears in `ext list`, dispatches by slug, and uninstalls cleanly; `ext create`
   produces a manifest the installer accepts on the first try.
4. **One truthful surface.** Docs, `--help`, the agent-facing skill reference, and the
   binary agree: dead commands removed, phantom flags removed or implemented, argument
   orders corrected, exit codes documented and honored, settings unified into one
   layered `settings.yaml`, and the reserved namespace expanded in one release.
5. **Introspectable policy.** A permissions CLI lets humans and agents list the
   effective policy, explain why a specific call was denied, and be guided into adding
   a scoped rule when blocked.

## Behaviour details

### Permission closure
- `godmode <ext> api /raw/path` is evaluated against the same policy as the equivalent
  named route; a matching deny rule blocks it with the standard denial message and a
  distinct exit code.
- When godmode serves an extension as an MCP server, each incoming tool call is
  evaluated against the effective policy of the directory the server was started in;
  denied calls return an MCP error result to the client and are not executed.
- MCP tools gain their own rule dimension: a rule can target individual MCP tools by
  name, so `methods:`-style constraints are meaningful for MCP-backed extensions.

### Fail-closed settings
- If any settings file in the resolution chain fails to parse, permissioned dispatch
  exits non-zero with `Error: cannot parse <path>: <reason> — refusing to run with an
  unreadable policy.` Read-only, non-permissioned commands (`--help`, `--version`,
  `ext list`) still work and repeat the warning.
- Agent-default settings move from `settings.json` into the same `settings.yaml`; on
  first run after upgrade, an existing `settings.json` is migrated automatically and
  the user is told what moved. Reading `settings.json` afterwards is not attempted.

### Publishing end to end
- `godmode ext install <npm-name>` installs the package, reads its manifest export,
  compiles it, and registers the slug. `ext list` shows it with its source (`npm`).
- `godmode ext uninstall <name>` removes the compiled manifest *and* the installed
  package directory; a subsequent `ext list` shows no trace.
- Package lookup respects project scope: a project-installed package extension is found
  when invoked from within that project.
- Install of a package whose slug collides with a reserved word fails with a message
  listing the reserved namespace.

### Wizard fix
- `godmode ext create` emits the current nested manifest format into
  `<dir>/manifest.yaml`, and its closing hint prints the real command
  (`godmode ext install ./<dir>`). Installing the generated manifest succeeds without
  edits. (The full authoring experience is 0200; this epic only makes today's wizard
  not-broken.)

### Exit codes & error classes
- Distinct, documented exit codes distinguish at minimum: success; upstream HTTP 4xx;
  upstream HTTP 5xx; permission denied; usage/parse error; extension or route not
  found. HTTP status line is printed to stderr on failure without needing
  `GODMODE_DEBUG`.
- `godmode agent … --harness=claude` (equals form) is accepted everywhere the
  space-separated form is.

### Docs & grammar convergence
- All docs pages use `godmode ext install`; `godmode extension add` appears nowhere.
  MCP invocation argument order in docs matches the binary. `agent stop` and `--debug`
  are either implemented or removed from docs — no phantom surface remains. The
  XDG_CONFIG_HOME question is decided (support it or delete the docs claim) — see Open
  questions. The agent-facing skill reference teaches only working commands.
- The reserved namespace is expanded in one release to include `ext`, `extension`,
  `agent`, `script`, `workflow`, `history`, `sessions`, `trace`, `auth`, `permissions`;
  installing an extension with any of these slugs fails with a clear message.

### Permissions CLI
- `godmode permissions list` prints the effective merged policy with each rule's origin
  file (global vs project).
- `godmode permissions explain <ext> <interface> <target>` prints the decision
  (allow/deny/default-deny), the winning rule, and its origin — exit 0 for allow,
  non-zero for deny.
- On a denied dispatch in an interactive terminal, godmode offers the exact rule that
  would allow the call and, on confirmation, appends it to the chosen scope. In
  non-interactive contexts it prints the suggested rule to stderr and exits with the
  permission-denied code.

### Test infrastructure
- The stale test adapter grammar is updated to the current dispatch grammar; the
  help-compliance suite asserts against the real extensions directory and demonstrably
  executes (a deliberate violation fails CI); the vitest workspace covers all packages
  and the interfaces.

### GraphQL parser
- Either the SDL parser handles interfaces, unions, and input types found in real
  schemas (github's included) with tests, or GraphQL SDL ingestion is explicitly marked
  experimental in `--help` and docs, with the `'{ query }'` invocation syntax
  documented. No silent mis-parsing of shipped extensions.

## Out of scope (v1)

- The full authoring wizard, archetypes, validate/test/publish loop — 0200.
- Registry search, provenance, pinning, install policies — 0800.
- Trace/audit records of permission decisions — 0700 (this epic only makes decisions
  correct; recording them is trace's job).
- Normalized event schema extension (tool-use events) — owned by 0300/0600 prep.
- `agent stop` implementation and zmx documentation beyond removing phantom docs — 0300.
- Credential handling changes — 0900.

## Open questions

- XDG_CONFIG_HOME: honor it (with `~/.godmode` fallback) or drop the docs claim? Leaning
  honor-it, since agents in sandboxes often relocate config roots.
- Exact exit-code numbering — needs one published table; do we reserve a contiguous
  block for future subsystems (workflow, agent) now?
- Fail-closed granularity: should a broken *project* settings file deny only
  project-scoped additions while global policy still applies, or deny everything?
- Does `permissions explain` accept a full previously-failed command line verbatim
  (`godmode permissions explain -- stripe api /v1/charges`) as sugar?
- Is GraphQL SDL robustness in-scope here, or formally de-scoped to a 02xx feature once
  the "experimental" label ships?

## Acceptance criteria

- Given a project `settings.yaml` denying `stripe`, running `godmode stripe api
  /v1/charges` (raw path) exits with the permission-denied exit code and executes no
  HTTP request.
- Given godmode serving the stripe extension over MCP from a directory whose policy
  denies a tool, when an MCP client calls that tool, the client receives an error
  result and the upstream API is never contacted.
- Given a `settings.yaml` containing invalid YAML, any permissioned dispatch exits
  non-zero and prints an error naming the file and parse reason; no call is executed.
- Given the same broken file, `godmode --help` and `godmode ext list` still succeed and
  print the warning.
- Running `godmode ext install <published-npm-extension>` followed by `godmode ext
  list` shows the extension with source `npm`, and invoking it by slug dispatches
  successfully.
- Running `godmode ext uninstall` on that extension removes it from listings and leaves
  no package directory behind (verified by inspecting the install root).
- Running `godmode ext create` and answering the prompts yields a `manifest.yaml` that
  `godmode ext install ./<dir>` accepts with zero edits, and the wizard's final hint is
  a command that works verbatim.
- A dispatch whose upstream returns HTTP 404 exits non-zero with the 4xx exit code and
  prints the status line to stderr without `GODMODE_DEBUG`.
- Permission denial, usage error, and route-not-found each produce distinct documented
  exit codes, distinguishable from HTTP failures.
- `godmode agent start --harness=claude` behaves identically to
  `godmode agent start --harness claude`.
- Grepping the docs content tree finds zero occurrences of `godmode extension add`,
  `--debug`, or `agent stop` (unless implemented), and every MCP example uses the
  binary's actual argument order.
- Attempting `godmode ext install` for an extension whose slug is any reserved word
  (`extension`, `script`, `workflow`, `history`, `sessions`, `trace`, `auth`, …) fails
  with a message listing the reserved set.
- After upgrade, a machine with legacy `settings.json` agent defaults gets them honored
  from `settings.yaml`, a one-time migration notice is printed, and edits to the old
  `settings.json` no longer change behaviour.
- `godmode permissions list` in a project with both global and project rules prints
  every effective rule annotated with its source file.
- `godmode permissions explain stripe api /v1/charges` prints the decision and winning
  rule; exit code is 0 when allowed and the permission-denied code when denied.
- A denied dispatch in a non-TTY context prints a copy-pasteable suggested allow rule to
  stderr.
- Introducing a deliberate help-compliance violation in a shipped extension causes the
  test suite to fail (proving the suite executes against the real extensions).
- `vitest` workspace run reports coverage entries for every package and interface, not
  only the CLI package.
- Either invoking the github extension's GraphQL routes parses its real SDL correctly
  under test, or GraphQL help output labels the interface experimental and documents
  the `'{ query }'` syntax.
