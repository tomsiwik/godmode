# 0500 — Workflows (`godmode workflow *`)

**Status:** Draft · **Level:** Epic · **Depends on:** 0300 (agent steps), 0400 (script steps, JSON I/O convention), 0600 (durable run store)

## Summary

Workflows are YAML-defined state machines in `.godmode/workflows/*.yaml` that compose
everything the rest of the portfolio provides: extension calls, script runs, agent
prompts, and human approval gates, executed as an ordered sequence of steps with
durable state. A run can stop at a gate, survive a reboot or an agent's context
compaction, and resume exactly where it left off. v1 is deliberately bounded — linear
steps, per-step retries, human gates, resume-from-failed-step — trading expressiveness
for a state model a human can read at a glance. Because every step goes through normal
godmode dispatch, per-step permission enforcement comes for free.

## Problem / Motivation

Multi-step processes around agents today are held together by prose prompts and hope:
"run the evals, then if they pass cut a changeset, then wait for me to approve, then
publish." Nothing durable tracks where such a process is; an agent that compacts its
context mid-process loses the plot; a failure at step 4 means re-running steps 1–3.
The building blocks now exist or are specified — extensions dispatch uniformly,
scripts (0400) have declared JSON I/O, agent turns (0300) are addressable and
streamable — but there is no composition layer. Prior art shows the shape: GitHub
Actions proves YAML step ergonomics, Temporal proves that signals (≙ our human gates)
and durable resumable state are the hard-won essentials, and `just`/`mise` are the
degenerate case — workflows with no state, no gates, and no I/O contract. godmode
workflows are the smallest step up from that degenerate case that still buys
durability and approval gates.

## User stories

- As a developer, I define a release train — build, test, changeset, *human gate*, publish — in one YAML file, run it, and approve the gate from my terminal when ready.
- As a team lead, I review the release workflow in a PR like any code, and know each step is still subject to the same permission rules as ad-hoc invocations.
- As an agent, I kick off a long task as a workflow so that if my context is compacted, the durable step state — not my memory — knows what is done and what is next.
- As an agent caller, I run a gated workflow with `--wait` so my invocation blocks until the human approves, instead of my having to poll.
- As a researcher, I run a nightly eval loop that prompts three different harnesses (via 0300) with the same task and collects their outputs through the shared JSON convention.
- As a developer, when step 4 of 6 fails at 2 a.m., I fix the cause in the morning and `workflow resume <run>` continues from step 4 — steps 1–3 do not re-run.
- As a developer, I check `workflow status <run>` and see per-step state, attempts used, and which gate (if any) it is waiting on.
- As an orchestrating agent, I list available workflows with `workflow list --json` and start one whose inputs I can satisfy.
- As a team lead, I mark the publish step's gate so that only a human — never an agent — can approve production publication.

## Feature description

A workflow is a named, ordered list of steps plus declared workflow-level inputs.
Each step is one of four kinds, all resolved through normal godmode dispatch:

- **extension** — call an installed extension operation (`stripe api ...`, `github graphql ...`);
- **script** — run a project script (0400), inputs validated as usual;
- **agent** — send a prompt to a harness (0300), optionally detached with a timeout;
- **gate** — pause for human approval, with an optional note shown to the approver.

Step I/O uses the JSON convention from 0400: each step's JSON output is addressable by
later steps via simple references (`${{ steps.<id>.outputs.<key> }}` — GitHub Actions
ergonomics deliberately). Steps may declare `retries: N`; a step is retried up to N
times before the run enters `failed`.

Runs are durable. Starting a workflow creates a run with an id; every step transition
is recorded in the shared durable store (cross-cutting decision 1, owned by 0600).
`workflow run` executes steps in order until completion, a gate, or a failure. Gates
are exit-and-resume by default: the process exits (successfully, with a
"waiting on gate" status) and a human later runs `workflow resume <run> --approve
<gate>`. For agent callers that prefer blocking, `--wait` keeps the invocation
attached, polling until the gate is resolved elsewhere or a timeout lapses — Temporal's
signal pattern with a CLI face.

**Deliberate v1 bounds — scoping decision, not oversight:** no parallel steps, no
sub-workflows, no loops, and only minimal conditionals (a step may declare `if:` on a
prior step's success/failure — nothing richer). Every cut feature is a state-model
complication; v1 optimizes for a run status a human can read top-to-bottom and trust.
Parallelism and composition are explicitly deferred, not rejected.

Permissions come free: each step is a normal dispatch, so the caller's effective
policy applies per step. A workflow file grants nothing by itself — an agent allowed
to start a workflow but denied `script:deploy-*` will see the run fail with a
permission error at exactly that step. Gates additionally support `approvers: human`
to refuse approval from agent contexts (default-deny consistency, decision 6).

## Behaviour details

CLI surface:

```sh
godmode workflow run <name> [--input k=v]... [--wait] [--json]
godmode workflow resume <run-id> [--approve <gate-id>] [--reject <gate-id>] [--wait]
godmode workflow status [<run-id>] [--json]      # no id: most recent run in this project
godmode workflow list [--runs] [--json]          # definitions, or past/active runs
godmode workflow stop <run-id>                   # abort an in-flight run
```

Example `.godmode/workflows/release.yaml` (interface, not implementation):

```yaml
name: release
inputs:
  bump: { type: string, enum: [patch, minor], default: patch }
steps:
  - id: test
    script: run-tests
    retries: 1
  - id: changeset
    script: cut-changeset
    with: { bump: "${{ inputs.bump }}" }
  - id: summary
    agent:
      harness: claude
      prompt: "Write release notes from ${{ steps.changeset.outputs.file }}"
      timeout: 5m
  - id: ship-gate
    gate:
      note: "Review notes at ${{ steps.summary.outputs.file }} before publish"
      approvers: human
  - id: publish
    script: publish-packages
    if: steps.ship-gate.approved
```

- **Run states:** `running → completed | failed(step) | waiting(gate) | stopped`.
  Step states: `pending → running → succeeded | failed(attempts) | skipped`.
- **Gate flow:** hitting a gate persists the run as `waiting`, prints the run id, the
  gate id, and the resume command, then exits 0. `resume --approve` continues from the
  next step; `--reject` moves the run to `stopped` with the rejection recorded.
- **`--wait`:** blocks across gates and long steps, streaming step transitions; exits
  with the run's terminal status. A `--wait` caller and an out-of-band `resume` may
  coexist — whichever resolves the gate first wins, the other observes it.
- **Failure & resume:** a failed step (retries exhausted) fails the run, preserving all
  prior step outputs. `resume <run-id>` re-attempts from the failed step with the same
  inputs and prior outputs intact. Editing the workflow definition between failure and
  resume is detected and warned about (resume uses the definition captured at start).
- **Errors:** unknown workflow, invalid workflow-level inputs (validated before step 1,
  same rules as 0400), unresolvable step reference (fails validation at start, not at
  the referencing step), permission denial at a step (run → `failed`, step names the
  denied resource), agent-step timeout (counts as step failure, retriable).
- **Permission interaction:** starting/resuming/stopping workflows are themselves
  gateable resources by workflow name (`workflow:release`); each step additionally
  passes its own dispatch check; an agent-context approval of a `approvers: human`
  gate is refused with a distinct error.

## Out of scope (v1)

- Parallel step execution and fan-out/fan-in.
- Sub-workflows / workflow calling workflow.
- Rich conditionals, loops, matrix expansion.
- Cron/scheduled triggers — workflows start only by invocation (external schedulers may invoke).
- Cross-machine or hosted execution; runs are local to the machine that started them.
- Compensation/rollback semantics on failure — prior steps' effects stand.
- A visual/status web UI; `status --json` is the integration surface.

## Open questions

1. Approval identity: does gate approval record *who* approved (OS user? configured identity?), and is that a v1 requirement for the release-train use case?
2. Agent-vs-human context detection for `approvers: human` — same mechanism as 0400's script approval; must be decided once, jointly.
3. Should agent steps default to capturing full normalized event streams (0300) into the run record, or only the final output, with events opt-in for cost reasons?
4. `--wait` timeout default: unbounded (Temporal-like) or bounded with explicit opt-out? Agents blocking forever on a forgotten gate is a real failure mode.
5. Does a `stopped` run permit resume, or is stop terminal? (Leaning terminal; rejection ≠ pause.)
6. Are workflow definitions subject to the agent-authored/pending-approval marker like scripts (0400), or is per-step gating deemed sufficient protection?
7. Reference syntax: adopt `${{ ... }}` verbatim from GitHub Actions for familiarity, or diverge to avoid implying full expression support?

## Acceptance criteria

- Given a valid workflow of three script steps, `godmode workflow run <name>` executes them in order and exits 0 with the run id printed; `workflow status <run> --json` shows all three steps `succeeded`.
- A later step observably receives an earlier step's output: a step referencing `${{ steps.a.outputs.x }}` runs with the value step `a` emitted.
- Given a workflow-level required input not supplied, `workflow run` exits non-zero naming the input, and no step executes.
- Given a step referencing a nonexistent step id, `workflow run` fails validation before executing step 1.
- Given a step with `retries: 2` whose action fails twice then succeeds, the run completes and `status` shows 3 attempts for that step.
- Given a step that exhausts retries, the run ends `failed`, `status` names the failing step, and prior steps' outputs remain queryable.
- Running `workflow resume <run-id>` on a failed run re-executes only from the failed step — earlier steps show their original timestamps and do not re-run.
- Hitting a gate exits 0, prints run id + gate id + the exact resume command, and `status` shows `waiting(gate)`.
- `workflow resume <run> --approve <gate>` continues execution past the gate to completion; `--reject` ends the run as `stopped` with the rejection recorded in `status`.
- `workflow run <name> --wait` on a gated workflow blocks until an approval issued from a second terminal, then exits with the run's terminal status.
- A gate with `approvers: human` refuses `--approve` from an agent context with a distinct non-zero exit; a human approval succeeds.
- Given a caller whose policy denies the resource used by step 3, the run fails at step 3 with a permission error naming the denied resource; steps 1–2 completed normally.
- Given a settings rule denying `workflow:release`, `workflow run release` exits non-zero before any step runs.
- A run interrupted by killing the process mid-step is resumable: `workflow resume <run>` continues from the interrupted step after the machine/process restart.
- A workflow containing an agent step completes with the agent's JSON output available to subsequent steps, on at least two different harnesses (0300 capability flags permitting).
- An agent-step `timeout` expiry marks the step failed (retriable) rather than hanging the run.
- `workflow list --json` returns definitions with their input schemas; `workflow list --runs --json` returns runs with state, current step, and gate (if waiting).
- `workflow stop <run-id>` on a `running` or `waiting` run moves it to `stopped` and any in-flight agent step is stopped via 0300 semantics.
