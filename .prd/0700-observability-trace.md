# 0700 — Observability & audit (`godmode trace`)

**Status:** Draft · **Level:** Epic · **Depends on:** 0600 (shared store), 0100 (dispatch bypasses closed)

## Summary

Every extension invocation already flows through one dispatch point, and the
permission layer already produces an allow/deny decision with a matching rule — but
nothing records any of it. This epic adds a local audit trail: one trace record per
invocation capturing extension, resource, method, permission decision, duration,
outcome, and the calling agent run when invoked from orchestration. `godmode trace`
lists, searches, and explains these records, answering both the security question
("what did the overnight agent actually call, and why was it allowed?") and the
research question (traces are the metrics substrate that, composed with 0300, 0500,
and 0600, turns godmode into an eval harness). Traces are local-only and live in the
shared SQLite store owned by 0600.

## Problem / Motivation

The permission system (`packages/cli/src/permissions.ts`) is a genuine default-deny
policy engine — but a policy engine without an audit log is half a security story. The
research notes record the current state bluntly: "no request/response history, no
invocation logging, no telemetry." When an agent runs unattended for hours with
`Bash(godmode:*)`, the human who granted that permission has no way to see what was
called, what was denied, or which rule made each decision. Debugging a deny today
means re-running with `GODMODE_DEBUG`; auditing yesterday's run means nothing at all.
The same gap blocks eval work: 0500 workflows can loop agents against tasks and 0600
holds normalized ground-truth dialogue, but without per-call metrics (what was
invoked, how long, did it succeed) there is nothing to score against. Default-deny
implies an audit companion; this epic is it.

## User stories

- As a developer, I want to see every call the overnight agent made — including denied ones — so that I can review unattended work before trusting it further.
- As a developer, I want `trace explain <id>` to show exactly which permission rule allowed or denied a call, so that I can fix policy instead of guessing.
- As a developer, I want to filter traces by extension, time window, and decision, so that "all stripe calls denied this week" is one command.
- As a team lead, I want a summary view of what extensions and resources an agent session touched, so that I can audit agent access without reading raw logs.
- As a researcher, I want per-call duration and outcome joined to the agent run that made the call, so that I can compute metrics for eval runs composed from 0300/0500/0600.
- As a developer debugging a workflow (0500), I want traces from a single workflow run grouped together, so that I can see which step's call failed.
- As a privacy-conscious user, I want traces to stay on my machine, never leave it, and be prunable, so that an audit log doesn't become a liability.
- As an agent, I am denied read access to traces by default, so that I cannot mine the audit log for reconnaissance or exfiltration targets.
- As a developer scripting against godmode, I want a documented opt-out, so that a hot loop of local calls doesn't accumulate records I don't want.

## Feature description

A **trace** is one record per dispatched invocation, written at the dispatch point
that every extension call already passes through. Each record captures, at minimum:

- extension slug, resource, method, and interface kind (api/graphql/mcp);
- the permission decision — allowed or denied — and, when a rule matched, an
  identification of that rule (scope: global or project; allow or deny; the matched
  resource/method pattern); when default-deny fired with no match, that fact;
- start time, duration, and outcome (success, error class such as HTTP status family
  or transport failure — never response bodies or request payloads);
- the caller: interactive shell, or the agent run id / workflow run id when the call
  originated inside 0300 orchestration or a 0500 workflow step.

Denied calls are traced exactly like allowed ones — a deny that leaves no record
defeats the audit purpose. MCP-served calls (godmode re-serving an extension as an MCP
server) trace through the same record shape once 0100 closes that enforcement gap.

**Recommendation: tracing is on by default**, with `--no-trace` per invocation and a
settings key to disable globally. Rationale: an audit log that must be remembered
before the incident is not an audit log, and the write is cheap and local.
Alternative (noted, not recommended): opt-in tracing — respects minimal-data
instincts but guts the security story; rejected for v1.

Traces are stored in the shared SQLite database at `~/.godmode/godmode.db` (0600 owns
the store; this epic owns trace record semantics). Traces are local-only: no network
egress, ever. Together with 0600 this completes the composition: normalized dialogue
as ground truth, workflows (0500) as the loop, orchestration (0300) as the executor,
traces as the metric stream.

## Behaviour details

### CLI surface

```
godmode trace list   [--extension <slug>] [--agent <run-id>] [--workflow <run-id>]
                     [--since <date|duration>] [--decision allowed|denied]
                     [--outcome success|error] [--limit N] [--json]
godmode trace show   <id> [--json]
godmode trace search <query> [same filters as list]
godmode trace explain <id>
godmode trace stats  [--since ...] [--agent <run-id>] [--group-by extension|resource|decision]
godmode trace prune  [--older-than <duration>] [--all] [--dry-run]
```

- `trace list` prints one row per record: short trace id, timestamp, caller (shell or
  agent run id), `extension resource METHOD`, decision, outcome, duration. Newest
  first. `--json` emits full records.
- `trace show <id>` prints the full record; unknown id → error naming the id,
  non-zero exit.
- `trace explain <id>` renders the permission story in prose: the evaluated
  extension/resource/method, whether a permissions block existed, which deny or allow
  rule matched (with its scope and pattern) or that default-deny applied with no
  match, and — for denials — the shape of a rule that would allow the call.
- `trace stats` answers "what did the overnight agent actually call": call counts,
  deny counts, error counts, and total/median duration, grouped by the `--group-by`
  dimension; `--agent <run-id>` scopes it to one orchestrated run.
- `trace search <query>` full-text matches over extension, resource, and error
  summary fields.
- Any `godmode <ext> ...` invocation accepts `--no-trace`; the call proceeds normally
  and no record is written. A settings key disables tracing globally; when disabled,
  `trace list` output states that tracing is currently off.

### Retention & pruning

- Default retention window applies automatically (proposed default: 90 days; exact
  value is an open question) — records older than the window are pruned
  opportunistically, and the effective window is configurable in `settings.yaml`.
- `trace prune --older-than 30d` deletes matching records and reports the count;
  `--dry-run` reports without deleting; `--all` empties the trace table after an
  interactive confirmation (or `--yes` non-interactively).
- Pruning traces never touches history (0600) or run records (0300) in the shared
  store.

### Permission interaction

- Reading traces from within an orchestrated agent run is **default-deny**, same
  posture and statement grammar as history access in 0600. A denied `trace list` from
  an agent is itself traced.
- Trace records inherit redaction guarantees: they never contain request payloads,
  response bodies, or credentials; error summaries pass the same redaction rules as
  0600 ingest and 0900 output scrubbing.

### Failure behaviour

- Tracing is fail-open for the primary call: if the trace store is unwritable, the
  extension invocation still proceeds and a one-line warning goes to stderr. Audit
  completeness is best-effort under storage failure; the failure itself is visible.

## Out of scope (v1)

- Exporting traces to external observability systems (OpenTelemetry export); the
  OTel GenAI semantic conventions inform naming only.
- Recording request/response payloads or headers — trace records are metadata-only
  by design, not a debugging proxy.
- Tracing arbitrary shell activity of agents; only invocations that pass through
  godmode dispatch are recorded.
- Alerting, thresholds, or any daemon watching traces.
- A TUI/dashboard; v1 is CLI tables, JSON, and stats.

## Open questions

- Default retention window: 90 days? Size-bounded instead of (or in addition to)
  age-bounded?
- Should `--no-trace` itself leave a minimal "a traced-off call happened" marker, or
  is a silent gap acceptable? (Silent gap weakens audit; a marker weakens the
  opt-out. Lean: silent gap in v1, revisit.)
- Should denied calls be exempt from `--no-trace` (denials always recorded)?
- Do MCP-served invocations record the connecting client identity, and how is it
  established?
- Exact join key between workflow runs (0500), agent runs (0300), and traces — one
  caller field with a typed prefix, or separate fields?
- Should `trace stats` grow a `--format markdown` for pasting audits into reviews?

## Acceptance criteria

- Given tracing at defaults, running `godmode stripe api customers list` (allowed by
  policy) results in `godmode trace list` showing a new record with extension
  `stripe`, the resource and method invoked, decision `allowed`, outcome, and a
  duration.
- Given a deny rule for a resource, invoking it produces a non-zero exit for the call
  AND a trace record with decision `denied`; `trace list --decision denied` includes
  it.
- `godmode trace explain <id>` for that denied record names the matching deny rule,
  its scope (global or project), its pattern, and shows an example allow rule that
  would permit the call.
- `godmode trace explain <id>` for a call allowed because no permissions block exists
  states exactly that; for a call denied by default-deny with no matching rule, it
  states that no allow rule matched.
- When an extension call is made from inside a `godmode agent` run, its trace record
  carries that run's id, and `trace list --agent <run-id>` returns only that run's
  calls.
- `godmode trace stats --agent <run-id> --group-by extension` prints per-extension
  call counts, denial counts, error counts, and duration figures for that run.
- `trace list --extension stripe --since 24h --outcome error` returns only stripe
  records from the last 24 hours whose outcome is an error.
- A call that fails at the HTTP level produces a trace record whose outcome reflects
  the error class (e.g. status family) without containing the response body.
- Running an invocation with `--no-trace` completes normally and adds no record:
  `trace list` count is unchanged.
- With tracing disabled in settings, invocations proceed untraced and `trace list`
  states that tracing is off in addition to showing existing records.
- `godmode trace prune --older-than 30d --dry-run` reports the count that would be
  deleted and deletes nothing; without `--dry-run` it deletes exactly those records
  and reports the count.
- After `trace prune --all --yes`, `trace list` is empty while `godmode sessions
  list` (0600) and agent run records (0300) are unaffected.
- `godmode trace list` invoked from within an orchestrated agent run with no allow
  rule for trace access is refused with a message naming the required rule, exits
  non-zero, and that refusal itself appears as a trace record.
- `godmode trace show <nonexistent>` prints an error naming the id and exits
  non-zero.
- No trace record, in any output mode, contains an Authorization header value, API
  key, request payload, or response body.
- If the trace store is unwritable, an extension invocation still succeeds, prints a
  single warning line to stderr about tracing, and exits with the call's own status.
