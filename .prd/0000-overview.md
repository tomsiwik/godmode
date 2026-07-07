# 0000 — godmode PRD Overview

**Status:** Draft · **Level:** Portfolio index · **Date:** 2026-07-05

## Vision

godmode is the Swiss Army knife CLI for coding agents. Today it unifies APIs, GraphQL,
and MCP servers behind one invocation grammar and one sandbox permission
(`Bash(godmode:*)`). This PRD collection extends that cornerstone into a full harness:
agents that can call tools, call *each other*, run fixed scripts, follow durable
workflows, and leave behind one normalized, searchable record of everything that
happened — across every coding agent on the machine.

The through-line: **everything an agent does goes through one grammar, one permission
model, and one event schema.** That is what makes godmode both a daily driver and a
research instrument for harness engineering.

## Epics

| Epic | File | One-liner |
|------|------|-----------|
| 01 | [0100-foundation-hardening.md](0100-foundation-hardening.md) | Close permission bypasses, fix broken authoring/publishing paths, converge docs with reality. |
| 02 | [0200-extension-authoring.md](0200-extension-authoring.md) | `godmode extension create` — interactive + non-interactive scaffolding, validate/test/publish loop, usable by humans and agents. |
| 03 | [0300-agent-orchestration.md](0300-agent-orchestration.md) | `godmode agent *` — async sub-agent dispatch, cross-harness RPC/messaging, discovery, unified agent identity. |
| 04 | [0400-scripts.md](0400-scripts.md) | `godmode script create\|run` — fixed, declared-I/O code blocks authored by humans or agents. |
| 05 | [0500-workflows.md](0500-workflows.md) | `godmode workflow *` — YAML state machines composing extensions, scripts, and agent turns with gates and resume. |
| 06 | [0600-sessions-history.md](0600-sessions-history.md) | `godmode history\|sessions *` — normalized LLM dialogue across all agent harnesses in a fast searchable SQLite index. |
| 07 | [0700-observability-trace.md](0700-observability-trace.md) | `godmode trace` — audit log of every tool call, permission decision, and agent action. |
| 08 | [0800-registry-trust.md](0800-registry-trust.md) | Extension search, provenance, pinning, and install policy for an ecosystem agents can safely extend. |
| 09 | [0900-auth-vault.md](0900-auth-vault.md) | Credential brokering — agents use APIs through godmode without ever seeing the secrets. |

## Sequencing & dependencies

```
01 Foundation ──┬── 02 Authoring ─── 08 Registry & trust
                │
                ├── 03 Orchestration ─┬── 05 Workflows
                │                     │
04 Scripts ─────┴─────────────────────┤
                                      │
06 Sessions & history ── 07 Trace ────┘
                              (07 shares 06's store & event schema)
09 Auth vault — independent; unblocks the full sandbox story any time.
```

- **Epic 01 comes first.** Two permission bypasses and a broken publishing path
  undermine the credibility of everything built on top.
- **Epics 03 and 06 share a prerequisite**: extend and version the normalized event
  schema (tool calls, permission decisions, errors — not just assistant text).
- **Epic 05 (workflows) composes 02/03/04** — it should land after at least
  orchestration and scripts have stable behaviour.

## Cross-cutting decisions (owned once, consumed everywhere)

1. **One durable store.** Orchestration runs, workflow state, history index, and traces
   all need local persistence. Decision: a single SQLite database (owned by Epic 06;
   Epics 03/05/07 consume). Sources of ingested history remain authoritative — the
   index is a rebuildable mirror.
2. **Normalized event schema v1.** `NormalizedEvent` today captures assistant text only.
   Version it and extend to tool calls, permission decisions, and errors. It becomes the
   contract for orchestration streaming (03), the standardized dialogue format (06), and
   trace records (07).
3. **Reserved command namespace.** `ext`/`agent` today; this portfolio adds `extension`,
   `script`, `workflow`, `history`, `sessions`, `trace`, `auth`. Reserve the full set at
   once — every reserved word is a slug extension authors lose.
4. **One agent identity.** Runs, live sessions, and peer messaging must resolve the same
   short, human-typable agent handle (docs already promise `a4-fox`-style slugs).
5. **One settings file.** Permissions, agent defaults, and new subsystem config converge
   on the layered `settings.yaml` (global + project overlay). The parallel
   `settings.json` is retired.
6. **Default-deny consistency.** Anything an agent authors (extension, script, workflow)
   installs project-scoped and is inert for agent callers until a human approves it —
   the same posture the permission system already takes.

## Conventions for this collection

- File naming: `.prd/EEFF-<slug>.md` — `EE` epic number, `FF` feature number
  (`00` = the epic itself). Features are split out later as `EE01`, `EE02`, …
- PRDs describe **behaviour, not implementation**: what a user or agent observes,
  never which module or library delivers it.
- Acceptance criteria are testable from the outside (CLI in, output/exit code/state out).
