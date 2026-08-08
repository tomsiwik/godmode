# 0000 — godmode PRD Overview

**Status:** Draft · **Level:** Portfolio index · **Date:** 2026-07-05

## Vision

godmode is the local capability runtime for coding agents. Today it unifies APIs,
GraphQL, and MCP servers behind one invocation grammar. This PRD collection extends
that cornerstone into a full harness:
agents that can call tools, call _each other_, run fixed scripts, follow durable
workflows, and leave behind one normalized, searchable record of everything that
happened — across every coding agent on the machine.

The through-line: **everything an agent does goes through one typed invocation contract,
one permission model, and one event schema.** MCP is a first-class import/export binding,
not a protocol godmode replaces. The architecture and security boundary are defined in
[0010-capability-runtime-spec.md](0010-capability-runtime-spec.md).

## Epics

| Epic  | File                                                               | One-liner                                                                                                                        |
| ----- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 00.10 | [0010-capability-runtime-spec.md](0010-capability-runtime-spec.md) | Define the capability IR, invocation ABI, extension boundary, security model, and MCP relationship.                              |
| 01    | [0100-foundation-hardening.md](0100-foundation-hardening.md)       | Close permission bypasses, fix broken authoring/publishing paths, converge docs with reality.                                    |
| 02    | [0200-extension-authoring.md](0200-extension-authoring.md)         | `godmode extension create` — interactive + non-interactive scaffolding, validate/test/publish loop, usable by humans and agents. |
| 03    | [0300-agent-orchestration.md](0300-agent-orchestration.md)         | `godmode agent *` — async sub-agent dispatch, cross-harness RPC/messaging, discovery, unified agent identity.                    |
| 04    | [0400-scripts.md](0400-scripts.md)                                 | `godmode script create\|run` — fixed, declared-I/O code blocks authored by humans or agents.                                     |
| 05    | [0500-workflows.md](0500-workflows.md)                             | `godmode workflow *` — YAML state machines composing extensions, scripts, and agent turns with gates and resume.                 |
| 06    | [0600-sessions-history.md](0600-sessions-history.md)               | `godmode history\|sessions *` — normalized LLM dialogue across all agent harnesses in a fast searchable SQLite index.            |
| 07    | [0700-observability-trace.md](0700-observability-trace.md)         | `godmode trace` — audit log of every tool call, permission decision, and agent action.                                           |
| 08    | [0800-registry-trust.md](0800-registry-trust.md)                   | Extension search, provenance, pinning, and install policy for an ecosystem agents can safely extend.                             |
| 09    | [0900-auth-vault.md](0900-auth-vault.md)                           | Credential brokering — agents use APIs through godmode without ever seeing the secrets.                                          |

## Sequencing & dependencies

```
00.10 Runtime contract
  └─ 01 Foundation ─┬─ 09 Auth vault
                    ├─ 02 Authoring ── 08 Registry & trust
                    └─ tasks/events/trace ─┬─ 04 Scripts ── 05 Workflows
                                           └─ 03 Orchestration ── 06 History
```

- **The runtime contract comes first.** It prevents each interface and subsystem from
  inventing its own discovery, invocation, policy, and event behavior.
- **Epic 01 is the first implementation slice.** Permission bypasses, fail-open policy,
  and legacy-only MCP behavior undermine the credibility of everything built on top.
- **Epic 09 is foundation work.** Policy cannot constrain an API while its raw credential
  remains visible to the caller.
- **Epics 03 and 06 share a prerequisite**: extend and version the normalized event
  schema (tool calls, permission decisions, errors — not just assistant text).
- **Epic 05 (workflows) composes 02/03/04** — it should land after at least
  orchestration and scripts have stable behaviour.

## Cross-cutting decisions (owned once, consumed everywhere)

1. **One capability IR and invocation ABI.** Source protocols compile into a lossless,
   typed capability model. CLI, MCP serving, scripts, and workflows enter the same
   runtime path. See 0010.
2. **One durable store.** Orchestration runs, workflow state, history index, and traces
   all need local persistence. Decision: a single SQLite database (owned by Epic 06;
   Epics 03/05/07 consume). Sources of ingested history remain authoritative — the
   index is a rebuildable mirror.
3. **Normalized event schema v1.** `NormalizedEvent` today captures assistant text only.
   Version it and extend to tool calls, permission decisions, and errors. It becomes the
   contract for orchestration streaming (03), the standardized dialogue format (06), and
   trace records (07).
4. **Capability namespaces over reserved commands.** New subsystems should use the
   public capability contract where possible. A top-level command is reserved only when
   it requires privileged runtime behavior.
5. **One agent identity.** Runs, live sessions, and peer messaging must resolve the same
   short, human-typable agent handle (docs already promise `a4-fox`-style slugs).
6. **One settings file.** Permissions, agent defaults, and new subsystem config converge
   on the layered `settings.yaml` (global + project overlay). The parallel
   `settings.json` is retired.
7. **Default-deny consistency.** Anything an agent authors (extension, script, workflow)
   installs project-scoped and is inert for agent callers until a human approves it —
   the same posture the permission system already takes. TTY presence is presentation
   context, not proof that the caller is human.

## Conventions for this collection

- File naming: `.prd/EEFF-<slug>.md` — `EE` epic number, `FF` feature number
  (`00` = the epic itself). Features are split out later as `EE01`, `EE02`, …
- PRDs describe **behaviour, not implementation**: what a user or agent observes,
  never which module or library delivers it.
- Acceptance criteria are testable from the outside (CLI in, output/exit code/state out).
