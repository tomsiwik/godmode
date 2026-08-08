# 0011 — Interface provider registry

**Status:** Review · **Level:** Architecture decision · **Date:** 2026-08-08

## Decision in this change

Keep the existing command shape:

```sh
godmode <extension> <interface> [interface arguments]
```

The caller selects an interface explicitly. `--help` is the discovery contract for the
operations and arguments that interface exposes. Interface names are lowercase CLI
tokens. This change does not introduce `godmode invoke`, change argument syntax, replace
the response body, or change the compiled `Route` model.

Replace the core's closed `api | graphql | mcp` set with an interface provider registry.
A provider owns one interface name and supplies:

- the usage tail shown in help;
- compilation from an extension's manifest source to installed interface data; and
- creation of the runtime interface handler.

The built-in API, GraphQL, and MCP interfaces register through this same seam. Manifest
validation accepts a declared interface only when a provider with that name is loaded.
Provider names use lowercase letters, numbers, and hyphens. Registration is
first-owner-wins: a second provider cannot replace an existing provider with the same
name.

An extension slug already namespaces its commands, so two extensions declaring `api`
do not collide: `stripe api` and `github api` are distinct paths. The registry therefore
owns interface-provider names, not every `<extension> <interface>` pair. Existing slug
occupancy continues to prevent one extension from replacing another extension's
top-level command.

This is an in-process registry and built-in bootstrap, not a public executable-plugin
loader. Loading provider code from an installed extension needs a separate decision
about package resolution, compatibility, isolation, and trust. Until that exists, a
manifest cannot make an unknown interface executable merely by naming it.

## Why this is the minimum useful registry

The previous accepted set appeared independently in four places: a TypeScript union,
manifest validation, compiler dispatch, and runtime dispatch. Adding an interface
required editing core in each place, and help silently described every unfamiliar
interface as REST. That was a closed implementation even though extensions are meant to
be extensible.

One provider registration now defines acceptance, help syntax, compilation, and runtime
creation. Duplicate registration fails instead of making behavior depend on import
order. The JSON Schema retains detailed schemas for built-in providers and permits an
object for another registered provider; the runtime registry remains the authority for
whether that key can execute.

## Points 3–5: evidence and limits

These are deferred observations, not requirements accepted by this change.

### 3. The compiled route is lossy for schema-driven arguments

`Route` retains `path`, `method`, `summary`, `version`, `tag`, and path segments. The
OpenAPI compiler does not retain operation parameters, request bodies, responses,
security requirements, or their schemas. The common argument parser stores query and
body values as `Record<string, string>`, and API validation currently accepts every flag.

The concrete consequence is narrow: godmode cannot derive and enforce a required,
typed `--limit` argument from an OpenAPI integer schema because that schema no longer
exists after compilation. This matters if the desired contract is schema-generated
flags, validation before network effects, or typed workflow wiring. It does not require
normalizing response JSON for a model; opaque JSON can remain the result. A future
change should start with an executable fixture proving that an invalid typed argument is
rejected before fetch. Without that requirement, expanding `Route` is unnecessary.

### 4. Runtime obligations are implemented by each handler

API/GraphQL route execution and MCP tool execution each call permission checks in their
own control flow. The known raw-path and MCP-serving bypasses have been repaired, so
this is not a claim of a current bypass. It is an extension-boundary risk: the provider
API introduced here returns a handler with direct execution authority, and a future
third-party provider could omit the same checks or produce different error behavior.

This matters only when executable providers become third-party or when godmode promises
that every effect passes through one invariant enforcement path. The stronger future
boundary would have providers describe an execution request and let core wrap policy,
credentials, and tracing. Its acceptance test should prove that a synthetic provider
cannot start an effect before the central policy decision. Building that runtime in this
registry PR would mix two decisions.

### 5. The interfaces share a prefix, not an operation grammar

After `godmode <extension> <interface>`, API, GraphQL, and MCP intentionally use different
operation syntax. That is observable, but under the chosen contract it is not itself a
defect: the caller chose the interface, and that interface's `--help` and schema define
the rest. Familiarity with native CLIs is a reason to keep these grammars instead of
forcing every source through an artificial `invoke` command.

It becomes a substantive problem only if godmode later requires scripts to swap one
interface provider for another without changing argv, or requires generic tooling to
construct calls without consulting interface help/schema. Neither requirement has been
accepted, so no unified operation grammar belongs in this change.

## Acceptance criteria

- API, GraphQL, and MCP behavior and command forms remain unchanged.
- Adding a synthetic lowercase provider requires no edit to a core interface union,
  accepted-name list, compiler map, runtime switch, or help switch.
- The synthetic provider is used for both compilation and runtime handler creation.
- Duplicate or non-lowercase provider names fail deterministically.
- A manifest key without a loaded provider is rejected before installation.
