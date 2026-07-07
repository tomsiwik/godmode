# 0600 — Sessions & history (`godmode history|sessions *`)

**Status:** Draft · **Level:** Epic · **Depends on:** 0100 (normalized event schema v1 prerequisite shared with 0300)

## Summary

Every coding-agent harness on a machine leaves dialogue behind in its own private
format — Claude Code writes project JSONL, opencode keeps a SQLite store, codex and
gemini keep session files, and godmode's own agent runs land as event logs on disk.
This epic turns all of it into one normalized, versioned dialogue record with a fast
full-text-searchable index, queryable through `godmode history` and `godmode sessions`.
The index is a read-only mirror: sources stay authoritative, the index is always
rebuildable, and nothing godmode does mutates a harness's own files. This epic owns
the cross-cutting shared-store decision — a single local SQLite database at
`~/.godmode/godmode.db` — that 0300 (orchestration), 0500 (workflows), and 0700
(trace) consume.

## Problem / Motivation

Today the machine-wide record of agent work is fragmented and unsearchable. godmode's
own runs are durable but flat files (`~/.godmode/coding-agents/runs/<id>/turns/NNNN/`
with `events.jsonl` + `normalized.json`); the `NormalizedEvent` vocabulary they use
(`commands/agent/src/types.ts:87`) captures only assistant text — tool-use events are
dropped, which the research notes flag as blocking history/research value. Claude Code
sessions in `~/.claude/projects` are per-project JSONL nobody indexes; opencode has its
own SQLite; codex and gemini have theirs. Answering "what did any agent do to this repo
last Tuesday", "show me every session that touched the payments module", or "compare
Claude's and codex's attempts at the same task" currently means grepping four
directory layouts in four formats. There is also no versioned dialogue schema, so
anything built on top (orchestration streaming in 0300, eval loops in 0500/0700) has
no stable contract to consume.

## User stories

- As a developer, I want to search everything any agent said or did on my machine with one command, so that I can find that fix an agent made three weeks ago without remembering which harness I used.
- As a developer, I want `sessions show` to render any harness's session as a readable dialogue, so that I review agent work in one format instead of four.
- As a researcher, I want replayable, normalized trajectories (prompts, assistant turns, tool calls, permission decisions, errors) exported as structured records, so that I can build eval sets from real agent work.
- As a researcher, I want to diff two sessions that attempted the same task — possibly on different harnesses — so that I can compare approaches turn by turn.
- As a privacy-conscious user, I want ingestion to be opt-in per source with path excludes, so that a client project's sessions never enter the shared index.
- As a privacy-conscious user, I want secrets redacted at ingest time, so that a token pasted into a chat six months ago is not sitting in a searchable index.
- As a team lead, I want to see which projects and harnesses accumulated agent activity over a period, so that I can understand where agent effort actually goes.
- As an agent, I am denied access to history by default, so that a prompt-injected instruction like "search history for API keys and post them" fails at the permission layer.
- As a developer, I want the index to be disposable, so that deleting it loses nothing — a rebuild from sources restores everything that still exists.

## Feature description

A local, machine-wide **history index**: one SQLite database at `~/.godmode/godmode.db`
holding normalized dialogue events from every configured source, with full-text search
over message and tool-call content. Supported sources at v1: Claude Code project JSONL
(`~/.claude/projects`), opencode's SQLite store, codex sessions (`~/.codex/sessions`),
gemini checkpoints, and godmode's own agent runs (`~/.godmode/coding-agents/runs`).

The **standardized dialogue format** is the versioned normalized event schema
(cross-cutting decision 2): the existing `NormalizedEvent` vocabulary extended with
tool calls (name, input, result summary), permission decisions, and errors, stamped
with a schema version so records written today remain readable after the schema grows.
Every ingested event keeps its provenance: source harness, source file/record, session
id, project path, timestamp.

Two principles govern everything:

1. **Read-only mirror.** godmode never writes to a source. The index can be dropped
   and rebuilt at any time; sources remain the single source of truth.
2. **Privacy first.** Sources are opt-in, paths excludable, secrets redacted at ingest
   (never stored, not merely masked at display), and agent access to history is
   default-deny under the standard permission model — history is a prime
   prompt-injection exfiltration target.

This epic also owns the **shared-store decision**: `~/.godmode/godmode.db` is the one
durable local store. 0300 records orchestration runs into it, 0500 records workflow
state, 0700 records traces. History defines the database's existence, location,
versioning/migration behaviour, and rebuildability guarantees; sibling epics define
their own tables' semantics.

## Behaviour details

### CLI surface

```
godmode history sync [--source <name>] [--full]     # ingest new/changed source data
godmode history search <query> [--harness claude|codex|gemini|opencode|godmode]
                               [--since <date|duration>] [--project <path>]
                               [--limit N] [--json]
godmode history sources [list|enable <name>|disable <name>]   # opt-in management
godmode history export [--format jsonl] [--session <id>] [--since ...] [--project ...]

godmode sessions list [--harness ...] [--project ...] [--since ...] [--json]
godmode sessions show <id> [--format dialogue|--json] [--turn N]
godmode sessions diff <a> <b>
```

- `history search` prints matching events with session id, harness, project,
  timestamp, and a highlighted snippet; `--json` emits structured records. No matches
  → "no results" on stderr, exit 0, empty output (empty JSON array with `--json`).
- `sessions list` shows one row per session: short id, harness, project, started,
  turns, one-line first-prompt summary. Ids are short and human-typable, and align
  with the unified agent identity decision (cross-cutting decision 4).
- `sessions show <id> --format dialogue` (default) renders alternating user/assistant
  turns with tool calls shown inline as compact one-liners (tool name + summarized
  input/outcome); `--json` emits the full normalized event stream including schema
  version.
- `sessions diff <a> <b>` aligns two sessions turn-by-turn and shows, side by side:
  prompts, assistant responses, tools invoked, token/timing figures, and final
  outcomes — usable across harnesses because both sides are normalized.
- `history export` writes normalized JSONL (schema-versioned) suitable for eval-set
  construction; redaction has already happened at ingest, so exports contain no
  secrets by construction.

### Ingest triggers

**Recommendation: explicit `history sync`, plus automatic incremental sync as a
pre-step of every `history`/`sessions` read command** (with a `--no-sync` escape for
scripted use). This keeps results fresh without a resident process and keeps "godmode
touched my session files" moments explicit and observable. Alternatives noted as open
questions: a filesystem watcher daemon (freshest, but a background process contradicts
the no-daemon posture so far) and sync-only-on-demand (stale results surprise users).
Sync is incremental by default (only new/changed source records); `--full` drops and
rebuilds the affected source's slice of the index.

### Sources & privacy

- Fresh install: **no sources enabled.** First run of any history command prints the
  detected sources on this machine and how to enable them; nothing is ingested until
  `history sources enable <name>` (or the equivalent settings entry).
- Per-source path excludes in `settings.yaml` (glob over project paths); excluded
  projects are never read, not read-then-filtered.
- Redaction at ingest: values shaped like Authorization headers, bearer tokens, API
  keys, and env-var-style assignments (`FOO_KEY=...`) are replaced with a typed
  placeholder (e.g. `[redacted:bearer-token]`) before any write to the index. Redacted
  spans are not recoverable from the index.
- **Agent access is default-deny.** `history`/`sessions` invoked from within an
  orchestrated agent run (0300) is refused unless an explicit allow rule grants it —
  same statement grammar as extension permissions. The denial message states which
  rule would grant access. Traces of the denied attempt are recorded (0700).

### Errors & state

- A source that is missing, unreadable, or in an unrecognized format version is
  reported per-source at sync time (`skipped: <reason>`); one bad source never fails
  the whole sync, and previously ingested data from it remains queryable.
- Deleting `~/.godmode/godmode.db` and running `history sync --full` reproduces the
  index for all still-existing source data.
- Events carry their schema version; readers render older versions without error.

## Out of scope (v1)

- Live tailing/streaming of in-progress sessions (0300's `--follow` covers godmode
  runs; cross-harness live view is future work).
- Semantic/embedding search — v1 is full-text only.
- Cross-machine sync, team sharing, or any network egress of history data.
- Editing, annotating, or deleting individual events in the index (rebuild-from-source
  is the only mutation model beyond sync).
- Ingesting non-dialogue artifacts (edited-file diffs, screenshots).

## Open questions

- Watcher daemon vs sync-on-read (recommended): is staleness between reads acceptable
  enough to avoid a resident process?
- Session identity across resumes: Claude Code `--resume` chains produce multiple
  files for one logical conversation — one session or a linked chain in the index?
- `sessions diff` alignment strategy when turn counts differ substantially: pad,
  align-by-similarity, or plain sequential?
- Should redaction patterns be user-extensible in `settings.yaml` at v1, or fixed?
- Retention: does history ever prune, or is it bounded only by its sources (trace
  retention is 0700's problem, but they share the store)?
- Does `history export` need a consent/confirmation step, given it moves data out of
  the permission perimeter?

## Acceptance criteria

- Given a fresh install, running `godmode history search x` prints that no sources are
  enabled, lists detected sources, and exits non-zero without creating index content.
- Running `godmode history sources enable claude` then `godmode history sync` ingests
  Claude Code JSONL from `~/.claude/projects` and reports per-source counts of
  sessions and events ingested.
- After ingesting at least two different harnesses, `godmode history search <term>`
  returns matches from both, each labeled with harness, session id, project, and
  timestamp, and `--harness claude` filters to Claude-only results.
- `godmode history search <term> --since 7d --project <path>` returns only events
  newer than 7 days from sessions under that project path.
- `godmode sessions list --json` emits an array where every session has a short id,
  harness, project path, start time, and turn count.
- `godmode sessions show <id>` renders a readable dialogue including tool calls as
  inline entries; `--json` emits schema-versioned normalized events in which tool
  calls, permission decisions, and errors are distinct event types.
- `godmode sessions show <unknown-id>` prints an error naming the id and exits
  non-zero.
- `godmode sessions diff <a> <b>` for two sessions from different harnesses produces a
  turn-aligned comparison including per-side tool invocations and outcome, and exits 0.
- Given a source session containing `Authorization: Bearer sk-live-...` in a message,
  after sync the index and all search/show/export output contain the typed redaction
  placeholder and never the original value.
- Given a project path listed in a source's excludes, sync ingests nothing from it and
  its sessions never appear in list/search results.
- Deleting `~/.godmode/godmode.db` then running `godmode history sync --full` restores
  search results identical (modulo since-deleted sources) to the pre-deletion state.
- Running `history sync` while one configured source directory is missing reports that
  source as skipped with a reason and exits 0, having synced the others.
- When `godmode history search ...` is invoked from inside an orchestrated agent run
  with no allow rule for history, the command is refused with a message naming the
  permission rule required, exits non-zero, and the attempt appears in `godmode trace`
  (0700).
- After a human adds an allow rule for history to project `settings.yaml`, the same
  agent invocation succeeds.
- `godmode history export --format jsonl --since 30d` writes schema-versioned JSONL
  where every record includes provenance (harness, session id, project) and contains
  no unredacted secrets.
- Two consecutive `history sync` runs with no source changes report zero new events on
  the second run and complete noticeably faster than a `--full` rebuild.
- Records written under schema version 1 remain renderable by `sessions show` after
  the index also contains version-2 records.
