# 0400 — Scripts (`godmode script create|run`)

**Status:** Draft · **Level:** Epic · **Depends on:** —

## Summary

Scripts are fixed, named code blocks with declared inputs and outputs, authored by
humans or by agents, stored project-scoped in `.godmode/scripts/` and shipped with the
repository. Where an extension wraps a *remote capability* (API, GraphQL, MCP), a
script wraps a *local step body*: deterministic-ish shell/code the team has reviewed
once and everyone — human or agent — can then invoke by name instead of re-deriving it
each session. `godmode script run` validates inputs against the declaration before a
single line executes, emits JSON output by convention, and passes through the same
permission gate as every other godmode resource. Agent-authored scripts are inert for
agent callers until a human approves them, keeping the portfolio's default-deny
posture.

## Problem / Motivation

Today the only "reusable local action" in godmode is whatever an agent re-types into
Bash each time. Recurrent multi-step incantations (regenerate types, seed a database,
cut a changeset, run the eval batch) live in chat history, in heads, or in an
unstructured `justfile` with no declared I/O and no policy layer. Agents rediscover
them badly and expensively; humans can't gate which ones an agent may run. The
dispatcher already reserves built-in namespaces (`ext`, `agent` — see cross-cutting
decision 3 in `0000-overview.md`), and the permission engine already gates arbitrary
resources, so the missing piece is behavioural: a first-class `script` noun with
create/run/list/show verbs, a manifest that declares inputs/outputs, and storage that
travels with the repo so scripts are reviewable in PRs like any other code. Workflows
(0500) need this as their step-body primitive; without declared JSON I/O there is
nothing to pipe between steps.

## User stories

- As a developer, I run `godmode script create` and am interviewed for name, description, inputs, and body — ending with a runnable, committed script.
- As a developer, I run `godmode script create release-notes --from last 5` to capture the commands I just ran interactively into a script skeleton I then edit.
- As an agent, I create a script non-interactively from flags/stdin after solving a task once, so the solution is durable — knowing it stays inert for me until a human approves it.
- As an agent, I run `godmode script run seed-db --input env=staging` and get JSON on stdout I can parse, with a non-zero exit if inputs are invalid or the body fails.
- As a developer, I see `.godmode/scripts/seed-db.yaml` in a teammate's PR diff and review the exact body and I/O contract before it lands.
- As a team lead, I write a permission rule allowing agents to run `script:test-*` but denying `script:deploy-*`, and it is enforced at dispatch.
- As a researcher, I give every eval-harness agent the same reviewed script for metric collection, so runs are comparable across harnesses and sessions.
- As a developer, I promote a script that has stabilized into a command-backed extension so other repos can install it.
- As an orchestrating agent, I list available scripts with their input schemas (`script list --json`) to decide which one fits the current task.

## Feature description

A script is a single manifest file: metadata (name, description, provenance —
human- or agent-authored), a typed input declaration, an output declaration, and a
body (inline shell or a referenced file in the same directory). Scripts live in
`.godmode/scripts/` at project scope — they are repo content, diffable, and reviewed
like code. There is no global script store in v1: a script's authority is the
project's.

Invocation is `godmode script run <name>` with inputs supplied as `--input key=value`
pairs or a single JSON object on stdin/flag. Inputs are validated against the
declaration *before execution*: missing required inputs, unknown keys, and type
mismatches abort with a descriptive error and nothing runs. On success, the script's
declared outputs are emitted as a JSON object on stdout (the body writes JSON, or
declares a single raw output that godmode wraps) — this JSON-in/JSON-out convention is
what lets workflow steps (0500) pipe one script's output into the next step's input,
and lets agents consume results without prose-parsing.

**Sandbox posture, stated honestly:** v1 scripts execute with the invoking user's full
shell authority. There is no VM, no syscall filter, no network isolation. Safety comes
from three real layers: (1) the body is fixed and reviewed, not generated per-call;
(2) inputs are validated and are data, not code; (3) the permission engine decides who
may run which script at all. A stronger sandbox (Deno-style permission flags) is a
noted future direction, not a v1 claim.

**Default-deny for agent authors:** a script whose provenance is agent-created carries
an unapproved marker. Unapproved scripts are listed (flagged as pending), runnable by
humans who explicitly acknowledge, but denied to agent callers until a human approves
(`script approve <name>`), flipping the marker in the committed file so approval itself
is diffable.

**Relationship framing:** a *script* is a step body; an *extension* is a remote
capability; a *workflow* (0500) is the composition. A script that outgrows one repo is
promotable: `script promote <name>` scaffolds a command-backed extension (0200 pipeline)
from its manifest, carrying over the declared I/O.

**Versus just/mise:** those are excellent stateless task runners; scripts differ in
exactly three behaviours — declared, validated I/O; permission gating per script name;
and JSON output that composes into workflows. A team using `just` loses nothing by
keeping it; scripts exist for the agent-facing contract.

## Behaviour details

CLI surface:

```sh
godmode script create [<name>] [--description ...] [--input name:type[:required]]...
                      [--output name:type] [--body-file f | --body-stdin]
                      [--from last [N]]            # seed body from recent shell history
godmode script run <name> [--input k=v]... [--json-input '{...}'] [--json]
godmode script list [--json] [--pending]           # pending = unapproved agent-authored
godmode script show <name> [--json]                # manifest incl. I/O schema + provenance
godmode script approve <name>                      # human ack; refuses inside agent context
godmode script promote <name>                      # scaffold extension from script (→ 0200)
```

Example manifest (`.godmode/scripts/seed-db.yaml`) — interface, not implementation:

```yaml
name: seed-db
description: Reset and seed the local database for one environment.
provenance: { author: agent, approved: false }
inputs:
  env:   { type: string, required: true, enum: [local, staging] }
  count: { type: integer, default: 50 }
outputs:
  seeded: { type: integer }
body: |
  ./scripts/reset.sh "$GODMODE_INPUT_ENV"
  echo "{\"seeded\": $GODMODE_INPUT_COUNT}"
```

- **Validation before execution:** any input error (missing, unknown, wrong type,
  enum violation) exits non-zero with the offending key named; the body never starts.
- **Output contract:** stdout of a successful run is exactly one JSON object matching
  the output declaration; declaration mismatches are reported as a distinct
  script-contract error (body ran, output invalid) with a non-zero exit.
- **Exit codes:** distinct classes for input-validation failure, permission denial,
  body failure (propagating the body's code where possible), and output-contract
  failure — so callers can branch without parsing text.
- **Permissions:** `script run <name>` is checked like any dispatch; resource globs
  work on script names (`script:deploy-*`). Deny wins; default-deny once a script
  block exists. `create` and `approve` are separately gateable actions.
- **State:** create writes the manifest file; approve mutates only the provenance
  marker; nothing else is stored outside the repo tree in v1 (run records join the
  shared store per 0600's cross-cutting decision when it lands).

## Out of scope (v1)

- Any real sandboxing (VM, container, network/filesystem isolation) — explicitly not claimed.
- Global (`~/.godmode/`) script scope; scripts are project-only.
- Script versioning/migrations beyond git itself.
- Non-shell body runtimes (dedicated Node/Python runners) — the body is shell; it may of course call anything.
- Parameterized script templates / inheritance.
- A registry for sharing scripts across repos — promotion to an extension (0200/0800) is the escape hatch.

## Open questions

1. Input transport into the body: environment variables (as sketched), argv, stdin JSON, or all three? Pick one primary convention before 0500 depends on it.
2. Does human `run` of an unapproved script require an explicit `--yes-unapproved` flag, or is interactive confirmation enough? Non-interactive human contexts (CI) need an answer.
3. How does godmode distinguish an agent caller from a human for the approval gate — invocation context marker, environment, or permission principal? (Shared with 0500's gate behaviour.)
4. Should `--from last N` read shell history, or only commands executed through a recording wrapper? Shell-history parsing is fragile and shell-specific.
5. Reserved name policy: `script` joins the reserved built-in namespace (cross-cutting decision 3) — confirm alongside `workflow`, `history`, `trace`, `auth`.
6. Is the output declaration required, or may a script declare `outputs: none` and still be workflow-composable as a fire-and-forget step?

## Acceptance criteria

- Running `godmode script create hello --input name:string:required --body-stdin <<< 'echo "{\"greeting\":\"hi $GODMODE_INPUT_NAME\"}"'` creates `.godmode/scripts/hello.yaml` and exits 0.
- `godmode script run hello --input name=tom` prints a single JSON object containing `greeting` and exits 0.
- `godmode script run hello` (missing required input) exits non-zero, names `name` as missing, and the body observably never executed.
- `godmode script run hello --input name=tom --input bogus=1` exits non-zero naming `bogus` as an unknown input.
- Given an input declared `integer`, passing `--input count=abc` fails validation before execution with a type error naming `count`.
- A script whose body exits 3 causes `script run` to exit non-zero with the body-failure class, and stderr from the body is passed through.
- A script whose body succeeds but prints JSON missing a declared output key exits non-zero with an output-contract error distinct from body failure.
- `godmode script list --json` returns an array where each entry includes name, description, input schema, and provenance/approval status.
- `godmode script show <name> --json` returns the full manifest including the input declaration an orchestrator needs to construct a valid call.
- Given a script created via non-interactive flags in an agent context, `script list --pending` shows it flagged; invoking it from an agent context exits non-zero with an approval-pending error.
- After a human runs `godmode script approve <name>`, the same agent invocation succeeds, and `git diff` shows only the provenance/approval field changed.
- `godmode script approve` invoked from an agent context refuses with a non-zero exit.
- Given a settings rule `deny script:deploy-*`, `godmode script run deploy-prod` exits non-zero with a permission-denied error and no execution; `script run test-suite` under an `allow script:test-*` rule succeeds.
- Committing `.godmode/scripts/` and cloning the repo elsewhere, `godmode script run <name>` works with no additional install step.
- `godmode script promote <name>` produces an extension scaffold whose declared operations mirror the script's I/O (verifiable via 0200's validate step) without deleting the original script.
- Interactive `godmode script create` completes a full definition (name, description, one input, body) via prompts and produces a manifest identical in shape to the non-interactive path.
