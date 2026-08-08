# 0010 — Capability runtime specification

**Status:** Draft · **Level:** Portfolio contract · **Date:** 2026-08-08

## Decision

godmode is a **local capability runtime for agents**, not a competing context transport.
It imports capabilities from APIs, GraphQL, MCP, commands, scripts, agent harnesses, and
desktop utilities; exposes them through one typed invocation contract; and applies
policy, credentials, provenance, task lifecycle, and audit at execution time.

MCP remains a first-class bidirectional binding. godmode consumes MCP servers and may
serve any compatible godmode capability through MCP. It does not fork MCP's wire
protocol, rename MCP primitives, or require MCP clients and servers to adopt a godmode
transport.

The product promise is:

> Install any API, MCP server, command, script, or workflow; invoke it through one typed
> CLI; enforce policy and credentials at execution time; expose the same capabilities
> back through MCP.

## Why this boundary

The Model Context Protocol specifies communication between an AI host and a capability
server. The 2026-07-28 revision is stateless per request, requires `server/discover`,
supports extension negotiation, caching, subscriptions, and multi-round-trip input,
and moves durable asynchronous execution into the official Tasks extension. It already
has a registry and a scriptable Inspector CLI.

Those features remove "MCP is stateful" and "MCP cannot support long-running work" as
useful differentiators. They do not define a local, cross-protocol runtime that owns:

- installation and integrity of API, CLI, script, workflow, and desktop adapters;
- one policy decision point across all imported capabilities;
- credential brokering that does not reveal a secret to the caller;
- a stable shell ABI independent of the source protocol;
- durable execution across heterogeneous tools and agent harnesses;
- normalized local audit and history.

godmode competes to be the execution layer an agent calls directly while remaining
compatible with the MCP ecosystem.

Primary references:

- <https://modelcontextprotocol.io/specification/2026-07-28>
- <https://modelcontextprotocol.io/specification/2026-07-28/changelog>
- <https://modelcontextprotocol.io/extensions/overview>
- <https://modelcontextprotocol.io/extensions/tasks/overview>
- <https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/cli>
- <https://modelcontextprotocol.io/community/working-groups/skills-over-mcp>

## Product boundary

### godmode owns

1. **Packaging.** An extension declares identity, provenance, compatibility, adapters,
   capabilities, credentials, and bundled guidance.
2. **Normalization.** Source-specific descriptions compile into a lossless capability
   intermediate representation (IR).
3. **Invocation.** Humans, agents, CI, and protocol adapters use one deterministic ABI.
4. **Enforcement.** A named principal is evaluated against policy before every effect.
5. **Execution.** The runtime owns credential resolution, cancellation, task handles,
   event emission, and result validation.
6. **Evidence.** Every decision and invocation can produce a redacted, local trace.

### godmode does not own

- A new network protocol for model-to-tool communication.
- A replacement for OpenAPI, GraphQL, MCP, OAuth, JSON Schema, or OpenTelemetry.
- Model inference or tool selection inside an AI host.
- A claim of OS isolation without an OS-enforced sandbox.
- A hosted workflow service in v1.

## Architecture

```
OpenAPI ─┐
GraphQL ─┤
MCP ─────┤                    ┌─ CLI / shell
command ─┼─ adapter ─> IR ─> runtime ─┼─ MCP server binding
script ──┤                    ├─ workflow step
agent ───┤                    └─ library API (future)
desktop ─┘
                       │
              policy · auth · tasks · trace
```

Adapters describe and execute source capabilities. The IR is the stable contract
between adapters and the runtime. Bindings present IR capabilities to callers. Policy,
auth, task lifecycle, and trace wrap runtime invocation rather than being reimplemented
inside each adapter.

An adapter is not automatically trusted because it produced a valid capability
description. Validation proves shape; provenance and install policy decide whether code
may run; invocation policy decides which effects a principal may request.

## Specification set

This portfolio produces four separately versioned contracts. A breaking change in one
does not silently change the others.

### 1. Extension Package Specification

An extension package MUST declare:

- stable slug, display name, version, and package-spec version;
- publisher/source identity and integrity material available to the installer;
- one or more adapters and their compatibility requirements;
- the capabilities supplied by each adapter or how to discover them deterministically;
- credential references by name and type, never credential values;
- whether installation or execution runs package code;
- bundled skills or documentation and their integrity coverage.

The package format distinguishes:

- **declarative adapters**, whose source document is compiled without running extension
  code; and
- **executable adapters**, which run extension-controlled code and therefore require a
  stronger install decision.

An extension MAY bundle multiple adapter kinds. Package installation MUST NOT imply
permission to invoke every resulting capability.

### 2. Capability IR Specification

The current `Route` shape is insufficient as the long-term IR because it loses source
semantics. Each normalized capability MUST retain, where applicable:

- a globally stable qualified name: `<extension>/<capability>`;
- kind: `operation`, `resource`, `prompt`, `subscription`, `workflow`, or `agent`;
- title, description, examples, and source-native identity;
- input and output JSON Schema without reducing structured bodies to strings;
- result content types and artifact references;
- declared effects such as `read`, `write`, `delete`, `network`, `process`, `desktop`,
  `credential-use`, and `agent-spawn`;
- idempotency and retry-safety metadata;
- credential requirements;
- synchronous, streaming, cancellation, and durable-task capabilities;
- adapter identity, source specification version, and provenance digest;
- policy labels independent of source transport verbs.

Unknown source fields MAY be retained in a namespaced metadata map. An adapter MUST NOT
flatten MCP resources, prompts, subscriptions, Apps, or Tasks into ordinary tool routes
when doing so changes their semantics.

Descriptions, effect annotations, and other extension-supplied metadata are untrusted.
Policy MUST NOT grant authority solely because an extension labels itself read-only or
idempotent.

### 3. Invocation ABI Specification

The canonical machine grammar is transport-independent:

```sh
godmode describe [<extension>[/<capability>]] --json
godmode invoke <extension>/<capability> --input-json '<value>' [--json]
godmode invoke <extension>/<capability> --input-file <path> [--events]
godmode task get|cancel|update <task-id> ...
```

Existing interface-oriented forms such as `godmode stripe api GET customers` remain
compatibility and human-convenience syntax. They resolve to the same qualified
capability and runtime invocation; they do not define a second permission path.

Machine mode obeys these rules:

1. Input is validated against the capability's JSON Schema before effects begin.
2. `--input-json` is parsed literally; it performs no undocumented string coercion.
3. Successful data goes to stdout. Diagnostics go to stderr.
4. `--json` emits one success object. `--events` emits versioned NDJSON.
5. Every failure belongs to a stable error class and exit-code class. Callers never
   need to scrape prose to distinguish usage, validation, policy, authentication,
   transport, upstream, contract, cancellation, and internal failures.
6. Discovery order is deterministic. A discovery result carries a digest or equivalent
   revision identifier so callers can cache it.
7. Every started invocation has an invocation id. Durable work additionally returns a
   task id that survives caller disconnection.
8. Cancellation is explicit and its cooperative or forceful semantics are reported.
9. A successful result with an output schema is validated before it is returned as
   successful.
10. Secrets MUST NOT appear in argv, stdout, stderr, events, dry-run output, or stored
    traces.

Human-facing help MAY infer shorthand and render prose. Machine mode MUST prefer a
rejected call over an inferred action when input is ambiguous.

### 4. Runtime Security and Event Specification

Every invocation carries a principal established by a trusted caller integration or an
explicitly documented fallback. Initial principal kinds are `human`, `agent`, `ci`, and
`protocol-client`, each with a stable id and optional parent invocation.

TTY presence MAY improve presentation but MUST NOT establish that a caller is human.
Likewise, an environment variable supplied by an untrusted child process MUST NOT grant
a stronger principal.

Before an adapter executes, the runtime MUST evaluate:

- principal and ancestry;
- qualified capability and declared/requested effects;
- extension provenance and installed version;
- project/global policy overlays;
- credential profile permitted for this principal and project.

Deny wins. Missing or unreadable policy fails closed wherever policy is expected.
Nested execution re-evaluates the underlying capability; a workflow, orchestrator, MCP
binding, raw path, or alias cannot launder authority.

Approvals are durable authorization records bound at minimum to principal, artifact
digest, requested effect, approver identity, and time. Approval through a pseudo-TTY is
not sufficient evidence of a human decision.

The versioned event envelope contains:

- schema version, timestamp, invocation id, task id, and parent id;
- principal, extension, capability, adapter, and source version;
- lifecycle type and status;
- policy decision and matching-policy reference;
- duration and normalized error class;
- redacted input/output summaries or references, according to policy.

OpenTelemetry trace context uses the standard `traceparent`, `tracestate`, and `baggage`
conventions when crossing a compatible binding.

## MCP binding requirements

MCP support is bidirectional and versioned independently from the IR.

### Consuming MCP

godmode MUST implement the modern 2026-07-28 request model before claiming compatibility
with that revision:

- `server/discover` and per-request protocol/capability metadata;
- `resultType` handling, including multi-round-trip `input_required` results;
- tools, resources, prompts, subscriptions, caching, pagination, and structured content
  for every supported primitive;
- the Tasks extension before mapping MCP tasks to godmode durable tasks;
- Streamable HTTP validation and OAuth requirements.

For stdio and HTTP interoperability, godmode SHOULD be dual-era: probe as specified by
MCP and fall back to initialization-based revisions only when the normative fallback
conditions are met. It MUST NOT advertise 2026-07-28 while sending a legacy initialize
handshake or `Mcp-Session-Id`.

### Serving MCP

Serving a godmode capability over MCP invokes the same runtime path as the CLI. It MUST
therefore preserve policy checks, credential brokering, tracing, input/output validation,
and task semantics. An MCP binding grants no authority by itself.

IR kinds map without forced equivalence: operations may map to tools, resources to
resources, prompts to prompts, and durable invocations to Tasks only when both peers
negotiated the extension. Unsupported semantics degrade only as documented by MCP or
the extension; otherwise the binding returns a capability error.

## Security claim and threat model

Until the acceptance criteria below pass, product copy MUST say that godmode
**centralizes policy checks**. It MUST NOT say that godmode is a sandbox or that
`Bash(godmode:*)` is sufficient isolation in every host.

The v1 threat model assumes:

- the godmode binary, trusted adapter code, policy files, and lockfile cannot be
  modified by the invoking agent;
- the host invokes godmode without permitting shell-command concatenation outside the
  approved command boundary;
- credentials are unavailable to the caller and unrelated child processes;
- executable extensions are untrusted until their exact version/digest is approved;
- godmode policy does not prevent direct network or filesystem access that the host or
  OS independently grants to the agent.

OS keychains protect storage, but credential brokering additionally requires integrity
of the binary, extension, endpoint, and policy selecting the credential. An approved
credential MUST NOT be attachable to an extension-controlled arbitrary origin.

## Portfolio sequencing

The contracts and trust boundary precede breadth:

```
0010 Capability runtime contract
  └─ 0100 Foundation: close bypasses, fail closed, modern/dual-era MCP
       ├─ 0900 Auth: principal-aware credential broker
       ├─ 0200 Extensions: adapter SDK, authoring, validation
       │    └─ 0800 Registry: provenance, integrity, install policy
       └─ Runtime core: tasks, events, cancellation, trace
            ├─ 0400 Scripts
            ├─ 0500 Workflows
            └─ 0300/0600 Agent orchestration and history
```

Agent orchestration and cross-harness history SHOULD begin as trusted extensions using
the same public capability and event contracts. A primitive moves into core only when an
external extension cannot implement it without privileged runtime access.

## Acceptance criteria

This document is a contract for subsequent feature PRDs. The architecture is proven
only when executable gates demonstrate all of the following:

- The same fixture capability can be discovered and invoked through CLI and MCP with
  schema-equivalent input and output.
- Raw API paths, aliases, workflows, scripts, and MCP-served calls hit the same policy
  evaluator as direct invocation.
- Corrupt policy causes no network, process, filesystem, desktop, or credential effect.
- A denied nested operation remains denied when wrapped by every supported binding.
- A caller without the raw credential can successfully invoke an allowed authenticated
  operation and cannot obtain the credential from environment, argv, output, events,
  traces, child processes, or extension-controlled endpoints.
- Machine discovery is deterministic and byte-stable when capabilities are unchanged.
- Machine input and output validate against the advertised schemas; invalid input has
  no effect and invalid output is not reported as success.
- Every documented error class has a stable JSON envelope and exit-code test.
- A durable task survives client termination, accepts input, reports progress, and can
  be cancelled according to its advertised semantics.
- A 2026-07-28 conformance fixture passes for both consuming and serving MCP; legacy
  compatibility is tested separately and cannot change modern behavior.
- The supported agent hosts have probes showing that their `godmode` command permission
  cannot be escaped through shell concatenation. Unsupported hosts receive no sandbox
  claim.

## Open questions

1. Is `<extension>/<capability>` the canonical identifier, or should identifiers include
   a kind (`stripe/operation/customers.get`) to prevent cross-kind collisions?
2. Does the first ABI version reserve stable numeric exit codes globally, or expose one
   non-zero process code plus a stable symbolic error in JSON?
3. Which principal issuer is trusted for each host, and what is the fallback when a host
   cannot provide authenticated caller identity?
4. Are executable adapters allowed in-process, or must the public plugin boundary always
   be subprocess RPC for crash and dependency isolation?
5. Which JSON Schema dialect is required for IR, and how are unsupported source-schema
   features preserved without pretending they were validated?
6. Does an extension declare effects, does the compiler infer them, or must both agree
   before policy may use the label?
7. Which MCP features are required for the first 2026-07-28 compatibility claim versus
   explicitly reported as unsupported capabilities?
8. Are workflows a core kind in IR or an extension-defined operation that happens to
   return a durable task?
