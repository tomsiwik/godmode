# 0200 — Extension authoring & scaffolding

**Status:** Finished · **Level:** Epic · **Depends on:** 0100

## Summary

`godmode extension create` becomes a first-class authoring loop: an interactive wizard
for humans and a fully flag-driven non-interactive mode for agents, scaffolding any of
five archetypes — OpenAPI-backed, GraphQL-backed, MCP-backed (remote or package/stdio),
command-backed, and orchestrator (an extension whose interfaces are themselves godmode
calls). The loop is closed by `extension validate` (schema check plus spec compile
dry-run), `extension test` (live smoke invocations), and a guided `extension publish`
flow. Every scaffold emits a per-extension `SKILL.md` so downstream agents learn usage
without reading manifests. Because agents are first-class authors, agent-created
extensions default to project scope and stay inert for agent callers until a human
approves them — the same default-deny posture as the rest of godmode.

## Problem / Motivation

Today the only authoring aid is `godmode ext create`, and it is broken: it emits the
legacy flat manifest format the installer rejects, writes `<name>.yaml` instead of
`manifest.yaml`, and hints a dead command (fixed to not-broken in 0100, but still
minimal). Authors instead copy one of the seven shipped extensions under `extensions/`
(stripe, slack, github, context7, claude-code-channels, …) and pattern-match — workable
for the OpenAPI case, opaque for GraphQL, MCP-package, and command-backed shapes.
There is no validation short of installing, no test harness, and the publishing docs
(`apps/docs/content/docs/publishing.mdx`) describe a contract that only starts working
with 0100. Nothing emits agent-facing usage docs, so every downstream agent rediscovers
invocation syntax by trial and error. And nothing distinguishes a human-authored
extension from one an agent generated thirty seconds ago and immediately wants to run.

## User stories

- As a developer, I run one command, answer a few prompts, and get a working extension
  wrapping my company's OpenAPI spec, installable on the first try.
- As an agent, I scaffold an extension entirely from flags — no TTY, no prompts — so I
  can wrap an API my human pointed me at mid-task.
- As a developer, I wrap an internal GraphQL endpoint and get route-per-field help
  output without hand-writing anything.
- As a developer, I wrap a remote MCP server (or an npm-published stdio MCP server) so
  my whole team reaches it through `Bash(godmode:*)` instead of per-tool MCP config.
- As a harness researcher, I build an orchestrator extension whose "routes" are
  compositions of other godmode calls, giving agents a coarse, safe verb instead of
  many fine-grained ones.
- As a developer, I run `extension validate` before committing and learn my manifest
  problem in seconds instead of at install time.
- As a developer, I run `extension test` and see each declared route smoke-invoked
  against the live backend with pass/fail per route.
- As an extension author, `extension publish` walks me through the npm publishing
  contract so the package installs cleanly for others (registry discovery is 0800).
- As a team lead, when an agent creates an extension in our repo, it cannot be invoked
  by agents until I approve it; I review the manifest and the emitted SKILL.md first.
- As an agent, after installing any extension I read its SKILL.md to learn call syntax,
  auth requirements, and examples without parsing the manifest.

## Feature description

The authoring surface is a lifecycle: **create → validate → test → publish**.

- **Create** scaffolds a directory containing `manifest.yaml`, a `SKILL.md`, and any
  archetype-specific assets. Interactive mode asks archetype, slug, spec source, and
  auth strategy; non-interactive mode takes everything as flags and fails loudly on any
  missing required input rather than prompting. A sixth entry point,
  `--from <installed-ext>`, clones an existing extension as a starting template.
- **Archetypes**: `api` (OpenAPI URL or file), `graphql` (endpoint + SDL source),
  `mcp-remote` (server URL), `mcp-package` (npm package spawning a stdio server),
  `command` (local commands exposed as routes with declared args), and `orchestrator`
  (routes defined as sequences/aliases of other godmode invocations, permission-checked
  per underlying call).
- **Validate** checks the manifest against the schema and dry-run-compiles the spec
  (fetch/parse OpenAPI or SDL, connect-and-list for MCP) without installing or
  invoking, reporting every problem with location context.
- **Test** installs (or uses the installed copy), invokes a configurable smoke subset
  of routes, and reports per-route pass/fail with upstream status.
- **Publish** verifies the package fulfills the manifest-export contract, checks the
  slug against the reserved namespace and obvious collisions, and prints the exact
  publish steps — guidance, not a wrapper around npm auth.
- **SKILL.md** is generated from the compiled routes: invocation grammar, auth env vars
  needed, per-interface examples, and top routes — regenerated on update so it never
  drifts from the manifest.
- **Agent authorship**: creations made by a non-interactive/agent caller install to
  project scope and are recorded as unapproved; dispatch by agent contexts is denied
  until `godmode extension approve <slug>` is run by a human in a TTY.

## Behaviour details

### CLI surface sketch

```
godmode extension create [dir]
  --archetype api|graphql|mcp-remote|mcp-package|command|orchestrator
  --slug <slug> --spec <url|path> --endpoint <url> --package <npm-name>
  --auth bearer|api-key|basic|none --auth-env <VAR>
  --from <installed-slug>
  --yes                # non-interactive: never prompt, fail on missing input
godmode extension validate [dir]        # exit 0 clean, non-zero with findings
godmode extension test <slug|dir> [--route <pattern>] [--dry-run]
godmode extension publish [dir]         # preflight + guided steps
godmode extension approve <slug>        # human ack for agent-created extensions
```

- With a TTY and no `--yes`, `create` runs the wizard; each prompt shows the equivalent
  flag so a human can graduate to scripted use. Without a TTY, missing required flags
  exit with a usage error listing exactly which flags are missing.
- `create` refuses reserved slugs (0100's expanded namespace) and refuses to overwrite
  an existing directory without `--force`.
- `--from stripe` copies the installed extension's manifest with slug/auth cleared,
  annotating each copied section with what to change.
- `validate` distinguishes error classes in output and exit code: schema violation,
  spec unreachable, spec unparseable, auth env var undeclared but referenced.
- `test` respects the permission layer like any dispatch: routes denied by policy are
  reported as `skipped (denied by policy)`, not failures.
- Orchestrator routes evaluate permissions per underlying call at invocation time — an
  orchestrator cannot launder a denied capability (deny still wins; see 0100).
- `publish` preflight failures (missing manifest export, reserved slug, name already
  installable from the curated index — see 0800) each print one actionable line.
- Approval state is visible: `godmode ext list` marks unapproved extensions; invoking
  one from an agent context exits with the permission-denied code and a message naming
  `godmode extension approve <slug>` as the remedy. Human TTY invocation of an
  unapproved project extension warns but proceeds.
- Every successful `create` and `update` (re)writes `SKILL.md` beside the manifest;
  installed extensions expose it via `godmode ext skill <slug>` (prints to stdout).

### State transitions

`scaffolded → validated → installed (approved | unapproved) → published`.
Unapproved → approved only via a human-in-TTY `approve`. Uninstall clears approval
state; reinstall by an agent returns to unapproved.

## Out of scope (v1)

- Registry search, curated index, provenance display, install policies — 0800
  (publish here ends at "npm package is correct"; discovery/trust is 0800's job).
- Script authoring (`godmode script create`) — 0400; command-backed extensions wrap
  existing commands, they do not author new code bodies.
- Workflow composition — 0500 (orchestrator routes are static call aliases, not state
  machines: no branching, no gates, no resume).
- Auto-generating extensions by crawling undocumented APIs.
- Manifest format redesign; authoring targets the current nested format as fixed by 0100.
- Secrets provisioning during create (declares auth env vars only) — 0900.

## Open questions

- Should `extension test` support recorded fixtures for CI (no live backend), or is
  live-only acceptable for v1?
- Orchestrator archetype: single-call aliases only, or short static sequences? Sequences
  edge toward 0500 territory.
- Is `approve` per-extension or per-(extension, version) — does an agent updating an
  approved extension's manifest reset approval?
- Does SKILL.md generation belong to install (all extensions, including third-party) or
  only to the authoring scaffold? Leaning install-time for universal agent benefit.
- Interactive wizard: offer to run `validate` + `test` automatically at the end?

## Acceptance criteria

- Running `godmode extension create my-ext --archetype api --slug my-ext --spec
  https://example.com/openapi.json --auth bearer --auth-env MY_TOKEN --yes` with no TTY
  produces a directory whose manifest `godmode ext install ./my-ext` accepts unmodified.
- The same command minus `--spec`, with no TTY, exits non-zero naming `--spec` as the
  missing required flag and prompts for nothing.
- Running `create` in a TTY without `--yes` walks through prompts and each prompt
  displays its equivalent flag.
- Each of the six archetypes (`api`, `graphql`, `mcp-remote`, `mcp-package`, `command`,
  `orchestrator`) scaffolds, validates, and installs successfully in a clean checkout.
- `create --slug workflow` (any reserved word) exits non-zero citing the reserved
  namespace before writing any files.
- `create --from stripe new-dir` produces a manifest that validates, with slug and auth
  values cleared/marked for replacement.
- `godmode extension validate` on a manifest with a schema violation exits non-zero and
  names the offending field and location; on a manifest whose spec URL 404s it exits
  non-zero with a distinct spec-unreachable error.
- `godmode extension validate` on every shipped extension in the repo exits 0.
- `godmode extension test petstore` invokes smoke routes and prints per-route
  pass/fail; a route denied by project policy prints `skipped (denied by policy)` and
  does not fail the run.
- `godmode extension publish` in a package missing the manifest export exits non-zero
  with a single actionable line describing the missing export.
- Every scaffolded and installed extension has a `SKILL.md` containing the invocation
  grammar, required auth env vars, and at least one runnable example per interface;
  `godmode ext skill <slug>` prints it.
- After an agent (non-TTY) creates and installs an extension in a project, `godmode ext
  list` marks it unapproved, and dispatching it from an agent context exits with the
  permission-denied code and names `godmode extension approve <slug>`.
- `godmode extension approve <slug>` run by a human in a TTY flips the state; the same
  dispatch then succeeds; running `approve` without a TTY fails.
- Uninstalling and agent-reinstalling a previously approved extension returns it to
  unapproved.
- An orchestrator route wrapping a call denied by policy fails with the permission-denied
  exit code at invocation, identical to calling the underlying route directly.
- Regenerating after a manifest change (`ext update` or re-`create`) rewrites SKILL.md
  so its examples match the new routes.
