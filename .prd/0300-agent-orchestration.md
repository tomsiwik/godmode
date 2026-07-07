# 0300 — Agent orchestration & messaging (`godmode agent *`)

**Status:** Draft · **Level:** Epic · **Depends on:** 0100 (event schema groundwork, stop/exit-code fixes land there or here — see Open questions)

## Summary

godmode already runs turns against four coding-agent harnesses and normalizes their
output streams; this epic grows that into a full orchestration layer. An agent (or a
human) forwards a prompt to any harness — Claude Code, Codex, Gemini, pi, opencode —
and gets a normalized response back, synchronously or detached. Live agents can
discover each other, exchange messages via mailboxes, and — where the harness supports
it — interrupt a peer mid-turn. One short, human-typable identity (`a4-fox`) addresses
an agent whether it is a run, a live session, or a messaging peer. The normalized event
schema, versioned as v1 and extended to tool calls, permission decisions, and errors,
becomes the streaming contract every consumer (05 workflows, 06 history, 07 trace)
reads.

## Problem / Motivation

The current `godmode agent` (`commands/agent/`) is a solid seed with hard edges. Turns
block synchronously until the harness finishes; there is no `agent stop` even though
`apps/docs/content/docs/agent.mdx` documents one; a dead harness can hang the caller
forever (`waitForFile` never times out); execution hard-depends on an external `zmx`
binary that is nowhere documented; codex has no stream parser and no session resume.
Identity is fractured three ways: runs are `run-<ts>-<uuid>`, the claude-code-channels
extension addresses peers by OS PID over Unix sockets, and the docs promise `a4-fox`
slugs that nothing issues. Messaging exists only between Claude Code sessions
(`extensions/claude-code-channels/src/channels.ts`), and the normalized event stream
drops tool-use events entirely — only assistant text survives, which starves the
history and trace epics. Harness adapters are hardcoded, so supporting opencode or a
new harness means a godmode release. None of this is usable as the "sub-agent fan-out
with one Bash permission" story the overview sells.

## User stories

- As a developer, I run `godmode agent "fix the failing test" --harness codex` and get the assistant's answer on stdout with a meaningful exit code, without learning codex's own CLI.
- As an agent with only `Bash(godmode:*)`, I spawn three sub-agents on different harnesses, poll their status, collect their outputs, and stop the slow one — never touching a harness binary directly.
- As an orchestrating agent, I dispatch a long refactor with `--detach`, keep working, and later fetch the result by the slug the dispatch printed.
- As an orchestrating agent, I send a message to a live peer agent's mailbox; if the peer's harness supports interrupt injection, I can flag the message urgent and it lands mid-turn.
- As a developer, I run `godmode agent list --alive` and see every live coding agent on the machine — harness, slug, working directory, and what it is currently doing.
- As a researcher, I stream normalized events (`--events`) from a run on any harness and get the same versioned JSON vocabulary — tool calls and permission decisions included — regardless of vendor stream format.
- As a developer, I attach to a detached agent's live output, detach again, and the run keeps going; ids stay stable across attach cycles.
- As a team lead, I write permission rules so CI agents may spawn sub-agents on `claude` only, and may message only agents they spawned.
- As a harness author, I make my agent CLI addressable by godmode by shipping an adapter, without a change to godmode itself.

## Feature description

Orchestration is four capabilities behind one verb family:

1. **Turn execution** — send a prompt to a harness, get back the normalized result.
   Modes: blocking (default), `--detach` (returns immediately with the agent slug),
   and `--events` streaming. Timeouts and `stop` bound every mode; orphaned harness
   processes are detected and reaped.
2. **Discovery** — enumerate agents: past runs, live godmode-managed sessions, and
   externally started harness sessions that adapters can detect. `--alive` filters to
   currently running; each entry shows harness, slug, cwd, age, and current activity.
3. **Messaging** — every live agent has a mailbox. `agent msg <slug> <text>` delivers
   at the next turn boundary; `--interrupt` requests mid-turn injection, which succeeds
   only where the harness adapter declares the capability and errors clearly otherwise.
   This generalizes the claude-code-channels design (mailbox + peer discovery +
   scheduled sends) beyond Claude-Code-only PID/socket peers.
4. **Identity** — one addressing scheme: short slugs (`a4-fox` style) issued at
   spawn, unique per machine among live agents, resolvable in every verb (`send`,
   `output`, `status`, `msg`, `stop`), and recorded against the durable run so history
   (0600) and trace (0700) join on the same key.

Harness adapters become a declared, pluggable surface: each adapter states which
capabilities it supports (streaming, resume, interrupt-inject, alive-detection), and
verbs degrade with explicit "harness X does not support Y" errors rather than silent
gaps. The normalized event schema v1 — versioned, covering turn lifecycle, assistant
deltas, tool calls, permission decisions, warnings, and errors — is the single contract
for `--events`, mailbox payloads, and downstream storage.

## Behaviour details

CLI surface (sketch — flags may consolidate):

```sh
godmode agent "prompt"                        # spawn + send + stream, blocking
godmode agent start [--harness <h>]           # start session, print slug
godmode agent send <slug> "prompt" [--detach] [--timeout 10m]
godmode agent output <slug> [--follow] [--json|--assistant-text|--events|--raw]
godmode agent status <slug>                   # running | idle | exited(code) | orphaned
godmode agent list [--alive] [--harness <h>] [--json]
godmode agent stop <slug> [--force]           # graceful, then kill on --force/timeout
godmode agent msg <slug|all> "text" [--interrupt] [--from <slug>]
godmode agent inbox [<slug>]                  # read own/target mailbox
godmode agent harnesses                       # adapters + capability flags
```

- **State transitions:** `starting → running → idle` per turn; `stop` moves any state
  to `exited`; a run whose harness process vanished without an exit record becomes
  `orphaned`, and `list`/`status` say so; orphans are reaped (marked exited, resources
  released) on next invocation of any agent verb.
- **Detached dispatch:** `--detach` prints the slug and exits 0 immediately. Completion
  is observable via `status`/`output`. `--timeout` applies in both modes; on expiry the
  turn is stopped and status shows `exited(timeout)`.
- **Streaming:** `--events` emits one JSON object per line, each carrying the schema
  version; unknown harness events pass through as typed `warning`/`raw` entries rather
  than being dropped. Tool calls and permission decisions appear as first-class events.
- **Messaging:** delivery is at-least-once into a durable mailbox; the receiving agent
  sees messages as tagged inbound content at the next turn boundary. `--interrupt` on a
  non-capable harness exits non-zero with a capability error naming the harness.
- **Errors:** dead harness binary, unknown slug, unsupported capability, and timeout
  each produce a distinct non-zero exit code and a one-line stderr message; `--json`
  yields a machine-readable error object.
- **Permissions:** spawning, messaging, and stopping are permission-gated resources
  like any dispatch. Rules can scope by harness and by target (e.g. allow
  `agent:spawn` on `claude/*`, allow `agent:msg` only to self-spawned children,
  deny `agent:stop` on agents the caller did not spawn). Default-deny applies once an
  agent-permission block exists; deny wins.

## Out of scope (v1)

- A long-lived daemon / HTTP server per agent (opencode-style client/server split).
- Cross-machine agent messaging; everything is local to one machine.
- Model-level sampling relays (MCP sampling passthrough).
- Automatic load balancing or scheduling across harnesses.
- Rich TUI attach (v1 attach is stream-follow plus stdin passthrough where supported).
- A2A-style public agent cards; discovery is local enumeration only.

## Open questions

1. Does `agent stop` + timeout land in 0100 (bug-fix tier) or here (feature tier)? The docs already promise `stop`.
2. Can the `zmx` dependency be dropped for detached execution, or is it vendored/bundled? Either way it must stop being an undocumented hard requirement.
3. Codex: is a stream parser feasible from its current CLI output, or does codex enter v1 as a reduced-capability adapter (no `--events`, no resume) with flags declared honestly?
4. Adapter pluggability mechanics: are third-party adapters installable like extensions (0200/0800 pipeline) or config-declared external commands?
5. Mailbox retention: do unread messages to an exited agent persist for its successor session, or die with the session?
6. Should `agent msg all` (broadcast) be permission-distinct from directed messaging?
7. Slug collision policy across machines for future 0600 ingestion — namespace by host now or later?

## Acceptance criteria

- Running `godmode agent "hi" --harness claude` prints the assistant reply and exits 0; a harness-reported failure exits non-zero.
- Running `godmode agent send <slug> "task" --detach` returns within ~1s printing the slug; `godmode agent status <slug>` subsequently reports `running` and later `exited(0)`.
- Given a running turn, `godmode agent stop <slug>` results in `status` = `exited` within a bounded grace period; `--force` kills immediately.
- Given `--timeout 5s` and a turn exceeding it, the turn is terminated and `status` reports a timeout-distinguishable exit.
- Given a harness process killed externally (`kill -9`), the next `godmode agent status <slug>` reports `orphaned` or `exited` — it never hangs.
- `godmode agent list --alive` lists every live godmode-spawned agent across at least two different harnesses with slug, harness, cwd, and age; exited runs are excluded.
- Every id printed by any agent verb is a short slug matching the documented pattern (e.g. `a4-fox`), and the same slug is accepted by `send`, `output`, `status`, `msg`, and `stop`.
- `godmode agent output <slug> --events` emits newline-delimited JSON where every event carries a schema version field, and a turn involving a tool call includes at least one tool-call event.
- Two live Claude Code agents exchange a message via `godmode agent msg`; the recipient's next turn shows the tagged inbound message; the same command works when the recipient runs under a second supported harness.
- `godmode agent msg <slug> "x" --interrupt` against a harness without interrupt capability exits non-zero with an error naming the harness and the missing capability.
- `godmode agent harnesses` lists each adapter with explicit capability flags (streaming, resume, interrupt, alive-detection); codex's reduced capabilities (if any) appear there, not as silent failures.
- Given a settings rule denying `agent` spawn for harness `gemini`, `godmode agent start --harness gemini` exits non-zero with a permission-denied message and no process is spawned.
- Given a rule restricting messaging to self-spawned agents, `godmode agent msg` to a foreign slug is denied; to a child slug it succeeds.
- An agent whose only sandbox grant is `Bash(godmode:*)` can complete a fan-out: spawn two sub-agents, collect both outputs as JSON, and stop both — verified end-to-end in a Claude Code sandbox.
- Messaging a nonexistent slug exits non-zero with "unknown agent" — distinct from the permission-denied exit.
- Detached runs survive the dispatching process exiting: dispatch with `--detach`, exit the shell, and `output <slug>` from a new shell returns the completed result.
