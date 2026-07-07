# 0800 — Extension registry & trust

**Status:** Draft · **Level:** Epic · **Depends on:** 0100, 0200

## Summary

Once extensions publish cleanly (0100) and anyone — including agents — can author them
(0200), godmode needs a discovery and trust layer: `godmode extension search` over a
curated index, provenance shown at install time (where the spec lives, which auth env
vars it wants, which interfaces it exposes), lockfile pinning of the resolved spec so
installs are reproducible, and install policies that let a team say "agents may only
install from the curated set". Typosquat and slug-hijack protections plus a
version-to-version spec diff on update close the loop: an ecosystem agents can extend
without a human auditing every npm package by hand. The posture mirrors the rest of
godmode — default-deny, deny wins, humans widen scope deliberately.

## Problem / Motivation

Current state: discovery is a hardcoded set of built-ins (the seven under
`extensions/`) plus raw npm names, folders, and manifest paths accepted by
`godmode ext install` (`apps/docs/content/docs/extensions.mdx:19-22`). There is no
search, no index, and no signal at install time about what an extension will do: a
manifest can point its spec at any host, demand any auth env var, and re-expose
everything over MCP, and the installer says nothing. Specs are fetched and compiled at
install time with no record of what was resolved — two machines installing "the same"
extension can compile different route sets if the upstream spec moved. Nothing stops an
agent from installing `strlpe` instead of `stripe`, and nothing distinguishes a curated,
reviewed extension from a package published five minutes ago. `ext update` replaces the
compiled manifest silently, so a spec that quietly grew a `POST /admin/*` surface is
invisible to the person who approved the original install.

## User stories

- As a developer, I run `godmode extension search stripe` and see curated matches with
  enough context (publisher, interfaces, auth needs) to pick one confidently.
- As a developer, at install time I see exactly which host the spec is fetched from,
  which env vars it will read, and which interfaces it exposes — before confirming.
- As a team lead, I set a policy so agents in this repo may only install extensions
  from the curated index; anything else requires a human.
- As an agent, when my install is blocked by policy, I get a machine-readable reason so
  I can ask my human for the specific approval instead of failing vaguely.
- As a developer, I commit a lockfile so teammates and CI compile the identical route
  set I reviewed, even if the upstream spec changes.
- As a security engineer, I trust that a near-miss slug of a popular extension is
  flagged rather than silently installed by an agent.
- As a developer, before `ext update` applies a new spec version I see a diff of routes
  added, removed, and changed — especially new write-capable surface.
- As a researcher, I audit which extensions on a machine came from the curated set
  versus ad-hoc sources.

## Feature description

Four capabilities, layered on the existing install grammar:

- **Search & curated index.** `godmode extension search <query>` queries a curated
  index (the shipped built-ins plus vetted community extensions). Results show slug,
  description, publisher, interfaces, auth requirements, and curation status. Search is
  discovery only — install still goes through `godmode ext install <slug>`, which
  resolves curated slugs preferentially over raw npm names.
- **Install-time provenance.** Every install prints a provenance summary before
  compiling: source (curated / npm / local path), spec host(s) it will fetch from, auth
  env vars the manifest declares, interfaces exposed, and whether the slug is curated.
  Interactive installs ask for confirmation when any non-curated or write-capable
  surface is present; non-interactive installs proceed only when policy allows and
  always print the summary.
- **Lockfile pinning.** Installing into a project records, per extension, the resolved
  source, version, spec URL, and a content digest of the fetched spec in a project
  lockfile. Subsequent installs from the lockfile reproduce the identical compiled
  route set or fail with a digest mismatch. Updates rewrite the lock entry only after
  the diff step below.
- **Install policy, anti-typosquat, and update diff.** The settings policy vocabulary
  (0100's layered `settings.yaml`) gains install statements — e.g. agents restricted to
  curated-only, or to an explicit allowlist of slugs/scopes. Deny wins; default posture
  for agent callers is curated-only. Installs of slugs within a small edit distance of
  a curated slug, or of a curated slug whose npm package identity changed since
  curation (hijack signal), are blocked pending explicit human confirmation.
  `ext update` (and lockfile-changing installs) show a route-level diff — added,
  removed, changed routes, with write-capable additions highlighted — and require
  confirmation interactively or an explicit flag non-interactively.

## Behaviour details

### CLI surface sketch

```
godmode extension search <query> [--json]
godmode ext install <slug|npm-name|path> [--locked] [--yes-diff]
godmode ext update <slug> [--yes-diff]
godmode extension info <slug>          # provenance for installed or curated ext
godmode ext list [--source curated|npm|local]
```

- `search` exits 0 with results, exits non-zero-distinct on no matches; `--json` emits
  one object per result for agent consumption.
- `install` of a curated slug prints `curated ✓` in the provenance block; a raw npm
  name that shadows a curated slug is refused with a message naming the curated one.
- `install --locked` (default in CI / non-TTY when a lockfile exists) fails on digest
  mismatch with an error naming the extension, the expected digest, and the resolved
  one; it never silently recompiles.
- Policy interaction: with `install: curated-only` for agent principals, an agent-run
  `godmode ext install some-random-pkg` exits with the permission-denied code and a
  reason string identifying the policy statement; `godmode permissions explain` (0100)
  covers install decisions too.
- Typosquat block: installing a slug within edit distance 1–2 of a curated slug prints
  `refusing: '<slug>' closely resembles curated extension '<curated>'` and requires an
  explicit human confirmation flag in a TTY; agents cannot override.
- Update diff: `godmode ext update slack` prints sections `added (N)`, `removed (N)`,
  `changed (N)`; write-capable additions (non-GET routes, new MCP tools) are flagged.
  Interactive: confirm to proceed. Non-interactive: requires `--yes-diff`, else exits
  non-zero having changed nothing.
- Extensions installed before this epic appear in `ext list --source` as `local`/`npm`
  with no curation mark; nothing breaks, trust features apply on next install/update.
- Agent-created extensions (0200) are always `local`, never curated, and remain behind
  the human-approval gate regardless of install policy.

### State transitions

Curated index entry → searchable → installed (locked) → updated (diff-reviewed, lock
rewritten). Digest mismatch or policy denial leaves prior installed state untouched.

## Out of scope (v1)

- Hosting a full package registry — the curated index is metadata over npm, not a new
  artifact host.
- Cryptographic signing / sigstore attestation of extensions (digest pinning only).
- Runtime sandboxing of extension network egress (permission layer scoping is 0100;
  real sandboxing is a future scripts/Deno-style story).
- Automated curation pipelines or community submission workflow — v1 curation is a
  maintained list.
- Vulnerability scanning of package-based extensions' npm dependency trees.
- Paid/private registries and per-org indexes.
- Trace records of install decisions — 0700.

## Open questions

- Where does the curated index live and how is it fetched — bundled with releases
  (offline-friendly, staler) vs fetched from a well-known URL (fresh, adds a network
  dependency and a trust root)?
- Lockfile location and name — inside `.godmode/` (travels with the project overlay) or
  repo root beside other lockfiles for visibility?
- Should global (non-project) installs also pin, or is pinning project-only in v1?
- Edit-distance thresholds: distance 2 catches more squats but will false-positive on
  legitimately similar slugs — is a curated "known distinct pairs" allowlist enough?
- What principal marker distinguishes "agent caller" from "human caller" for install
  policy — TTY detection alone is spoofable by wrapping in a pty; is that acceptable
  for v1?
- Does `search` cover MCP-server directories beyond the godmode curated set, or stay
  godmode-extensions-only?

## Acceptance criteria

- Running `godmode extension search stripe` prints at least the curated stripe
  extension with slug, publisher, interfaces, and auth env vars; `--json` emits valid
  JSON objects with those fields.
- `godmode extension search zzznope` exits with the documented no-results code and
  prints no results.
- Running `godmode ext install stripe` prints a provenance block naming the spec
  host(s), declared auth env vars, exposed interfaces, and `curated` status before any
  spec is compiled.
- Installing a non-curated npm extension in a TTY asks for confirmation after the
  provenance block; declining leaves nothing installed.
- After a project install, the project lockfile contains the extension's resolved
  source, version, spec URL, and spec digest.
- On a machine with the lockfile, `godmode ext install --locked` reproduces a compiled
  route set identical to the original (verified by identical route listings).
- If the upstream spec changed, `install --locked` exits non-zero naming the extension
  and both digests, and installs nothing.
- With policy `agents: install curated-only`, an agent-context `godmode ext install
  random-npm-pkg` exits with the permission-denied code and a reason naming the policy
  statement; the same command run by a human in a TTY may proceed after confirmation.
- `godmode permissions explain` for a blocked install prints the winning install-policy
  statement and its origin file.
- Attempting `godmode ext install strlpe` (edit distance 1 from curated `stripe`) is
  refused with a message naming `stripe`; no non-interactive override exists.
- A curated slug whose underlying npm package identity differs from the curation record
  is refused pending explicit human confirmation, with a hijack warning printed.
- `godmode ext update <slug>` against a changed spec prints added/removed/changed route
  sections and highlights new write-capable routes; in a TTY, declining leaves the
  installed compiled manifest and lockfile byte-identical.
- Non-interactive `ext update` without `--yes-diff` on a changed spec exits non-zero
  and changes nothing; with `--yes-diff` it applies the update and rewrites the lock
  entry.
- `godmode ext list --source curated` lists only curated-origin installs;
  `--source local` includes agent-created extensions, which never show a curation mark.
- An agent-created extension (0200) remains dispatch-denied for agents until human
  approval, even under the most permissive install policy.
- `godmode extension info <installed-slug>` prints the recorded provenance (source,
  version, digest, install time) matching the lockfile entry.
