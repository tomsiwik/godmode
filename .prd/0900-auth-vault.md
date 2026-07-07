# 0900 — Auth vault & credential brokering

**Status:** Draft · **Level:** Epic · **Depends on:** — (independent; unblocks the full sandbox story any time)

## Summary

godmode's sandbox pitch is that an agent needs only `Bash(godmode:*)` and godmode's
permission layer scopes everything inside it — but today every credential is a raw
environment variable that any process, including the agent itself, can read directly.
This epic replaces env-var plumbing with an OS-keychain-backed vault: `godmode auth
login <extension>` stores a credential once, godmode injects it only at call time
inside its own process, and the secret never appears in the calling agent's
environment, in errors, in debug output, or in trace/history records. Multiple
profiles per extension (e.g. stripe test vs live) with project-scoped defaults, a
graceful migration story alongside existing env vars, and actionable
missing-credential errors complete the picture. The result: an agent can *use*
stripe through godmode without ever being *able to read* the stripe key.

## Problem / Motivation

Extension auth today is `auth: { env: STRIPE_API_KEY }` in the manifest; at request
time the interface reads `process.env[authConfig.env]`
(`interfaces/api/src/request.ts:34`) and the missing-key error even instructs users
to "Set it in .env or export it in your shell." That means the credential lives in
the environment of the shell that launches the agent — so a sandboxed agent granted
only `Bash(godmode:*)` can call stripe through godmode *and* run
`echo $STRIPE_API_KEY`. Permission rules scoping stripe to read-only are theater if
the raw key is one env lookup away: the agent can curl the API directly with full
privileges, and any prompt-injected instruction can exfiltrate the key verbatim.
Secondary pains: keys in `.env` files leak into dotfile backups and repos, there is
no way to run one project against stripe test keys and another against live, and
nothing today guarantees a key never lands in debug output or the future
trace/history stores (0600/0700).

## User stories

- As a developer, I want to log in to an extension once (`godmode auth login stripe`) and have every project on my machine use it, so that keys stop living in `.env` files.
- As a developer, I want godmode to use my stored credential without it ever entering my agent's environment, so that granting `Bash(godmode:*)` doesn't hand over the key itself.
- As a developer, I want OAuth device-code login for providers that support it, so that I never handle a raw token for those services at all.
- As a developer, I want separate `test` and `live` profiles for stripe with a per-project default, so that an agent working in a sandbox project physically cannot hit live billing.
- As a privacy-conscious user, I want credentials in the OS keychain rather than plaintext files, so that they inherit the OS's locking and access-control behaviour.
- As a developer migrating, I want my existing env vars to keep working with a clear precedence order, so that adopting the vault is incremental and nothing breaks on day one.
- As an agent, when a credential is missing I want the error to tell me it's a human-only step (`run: godmode auth login stripe`), so that I can report the exact remediation instead of flailing.
- As a team lead, I want `godmode auth status` to show which extensions are authenticated, from which source (vault or env), and with which profile — without revealing any secret material — so that I can audit a machine's credential posture at a glance.
- As a researcher exporting history (0600) and traces (0700), I want a guarantee that no stored record ever contained a live credential, so that sharing eval data is safe.

## Feature description

An **auth vault**: per-extension credentials stored in the operating system's
keychain (macOS Keychain, and the platform equivalent elsewhere), written by
interactive `godmode auth login` flows and read only by godmode itself at the moment
a call needs them. Credential brokering means the secret's lifecycle is entirely
inside godmode's process during a call: fetched from the keychain, attached to the
outbound request per the extension's declared auth type (bearer, api-key, basic),
and never exported to child processes, never printed, never persisted anywhere else.

Two login shapes:

- **Paste/prompt**: `godmode auth login <extension>` prompts for the secret with
  hidden input (no echo), validates shape where the extension declares one, and
  stores it. Non-interactive entry reads from stdin for scripted provisioning —
  never from a command-line argument, which would leak via shell history and process
  lists.
- **OAuth device code**: for extensions that declare an OAuth device-code capability,
  login prints a verification URL and user code, polls until the user approves in a
  browser, and stores the resulting token. Refresh happens transparently inside
  godmode when the provider supports it; the agent-visible behaviour is simply that
  calls keep working.

**Profiles**: each extension can hold multiple named credentials (`default` implied).
`godmode auth login stripe --profile live` adds one. A project's `.godmode/` settings
can select that project's default profile; `--profile` on any invocation overrides
per call. Profile *names* are visible everywhere; profile *values* nowhere.

**Precedence during migration** (explicit, documented, shown by `auth status`):

1. Explicit `--profile` flag on the invocation → that vault profile.
2. Project-scoped default profile → that vault profile.
3. Vault `default` profile for the extension.
4. The manifest's declared env var, if set — with a one-line deprecation-style notice
   on stderr (suppressible) so users know the vault would take precedence once
   populated.
5. Nothing → the actionable missing-credential error.

Vault beats env var whenever both exist; env vars keep working indefinitely for
compatibility, but the messaging steers toward the vault.

**Redaction guarantees** (ties to 0600/0700): credential values never appear in
normal output, error messages, `GODMODE_DEBUG` output, `--dry-run` request previews
(auth headers render as `Authorization: Bearer [redacted:stripe/live]`), trace
records, or history-ingestible artifacts. This is a stored-data guarantee, not a
display filter.

## Behaviour details

### CLI surface

```
godmode auth login <extension> [--profile <name>]      # prompt, stdin, or device-code
godmode auth logout <extension> [--profile <name>|--all]
godmode auth list                                      # extensions × profiles × source
godmode auth status [<extension>]                      # effective credential resolution
godmode <ext> <interface> ... [--profile <name>]       # per-call profile override
```

- `auth login` on success prints the extension, profile, and storage location kind
  ("stored in system keychain") — never any part of the secret. Re-login to an
  existing profile asks to overwrite (or `--force`).
- `auth list` prints a table: extension, profiles present, auth type, source
  (keychain / env-var-only / none), and whether a project default profile is active
  in the current directory. No secret material, not even truncated prefixes.
- `auth status stripe` explains the resolution the next call would use in the current
  directory: which precedence step wins and why (e.g. "project default profile
  `test` (from ./.godmode/settings.yaml)"), plus a note if an env var is set but
  shadowed by the vault.
- `auth logout stripe --profile live` removes exactly that keychain entry and
  confirms; `--all` removes all of the extension's profiles after confirmation.
  Logout never touches env vars and says so if one remains active.
- OS keychain interaction follows OS rules: if the OS prompts for keychain unlock,
  that prompt is the OS's own; a locked/denied keychain surfaces as a clear godmode
  error distinguishing "denied by OS" from "no credential stored."

### Missing credential behaviour

Any call needing auth with nothing at any precedence step fails before any network
attempt, exits non-zero, and prints:

```
stripe requires authentication and no credential was found.
  To fix (human step): godmode auth login stripe
  Or set the STRIPE_API_KEY environment variable (legacy).
```

The same message is what an agent sees, so it can relay the exact human action
required. `--dry-run` still works without credentials and marks the auth header as
`[missing]`.

### Isolation

- Credentials are attached inside godmode only. Child processes spawned by godmode
  (agent harnesses in 0300, scripts in 0400, MCP server processes) inherit an
  environment from which vault-resolved secrets are absent.
- godmode never writes a credential to any file, log, or store outside the OS
  keychain. There is deliberately no `auth show`/`auth export` command in v1.

### Permission interaction

- `auth login|logout` are interactive, human-only operations: when invoked from
  within an orchestrated agent run (0300), they are refused (default-deny posture,
  consistent with 0600/0700) — agents can trigger the *need* for auth, never the
  *provisioning* of it.
- `auth list`/`auth status` from an agent follow the standard permission model
  (default-deny, allowable by rule) since even metadata ("live profile exists") is
  reconnaissance-adjacent.

## Out of scope (v1)

- Team/shared credential sync or any remote vault backend — this is a local,
  single-machine store.
- Short-lived credential minting or scoped-token derivation (asking providers for
  down-scoped tokens per permission rule) — powerful, later.
- Encrypted-file fallback vault on platforms without a keychain; v1 targets
  keychain-capable platforms and states so plainly elsewhere.
- Automatic migration/import of existing `.env` values into the vault (a guided
  `auth login` suggestion may mention the env var's existence, but never reads and
  stores it silently).
- Rotating or validating credentials against the provider (`auth status` reports
  presence and resolution, not liveness).

## Open questions

- Fallback for Linux setups without a Secret Service implementation: refuse vault
  features, or ship an encrypted-file backend behind an explicit opt-in?
- Should extensions be able to declare multiple named credential *fields* (key +
  secret pairs, e.g. AWS-style), and how does that surface in `auth login` prompts?
- Is the env-var deprecation notice per-invocation too noisy for CI? (Likely: notice
  once per day per extension, or suppress when not a TTY.)
- Should the project default profile live in `settings.yaml` proper (shareable,
  committed) vs a local-only file (profiles like `live` may be personal)?
- Device-code flow: which shipped extensions can actually offer it at v1, and does
  the manifest schema addition land in this epic or 0200?
- Should `--profile` mismatches (flag names a profile that doesn't exist) list
  available profile names, or is that already too much metadata for agent callers?

## Acceptance criteria

- Running `godmode auth login stripe` prompts with hidden input, stores the value in
  the OS keychain, prints a confirmation naming extension and profile, and never
  echoes any part of the secret; the secret appears in no file under `~/.godmode/`
  or the project.
- Piping a secret via stdin to `godmode auth login stripe` in a non-TTY context
  stores it without prompting; passing a secret as a command-line argument is not
  supported and login says so.
- With a vault credential stored and the manifest's env var unset, a stripe call
  succeeds; the spawned request carries auth while `env | grep STRIPE` in the
  calling shell shows nothing godmode added.
- With both a vault credential and the env var set to different values, the call
  uses the vault value and a single stderr notice states the env var is shadowed.
- With only the env var set (no vault entry), the call succeeds unchanged from
  today's behaviour — migration is non-breaking.
- With neither present, the call exits non-zero before any network activity and the
  error names the exact remediation command `godmode auth login stripe` and the
  legacy env var alternative.
- `godmode auth login stripe --profile live` followed by `godmode auth list` shows
  stripe with profiles `default` and `live`, source keychain, and zero secret
  characters anywhere in the output.
- Given a project whose `.godmode/` settings select profile `test`, a stripe call in
  that project uses `test`; the same call with `--profile live` uses `live`; and
  `godmode auth status stripe` in that directory names `test` as the effective
  profile and cites the project settings as the reason.
- `--profile nosuch` on a call fails with a non-zero exit stating the profile does
  not exist for that extension, without falling back to another credential.
- `godmode auth logout stripe --profile live` removes only that profile: subsequent
  `auth list` shows `default` remaining, and a `--profile live` call now fails with
  the missing-credential error.
- For a device-code-capable extension, `godmode auth login <ext>` prints a
  verification URL and user code, completes storage after browser approval, and a
  subsequent call succeeds without the user ever seeing a raw token.
- With `GODMODE_DEBUG` enabled, request/response debug output for an authenticated
  call renders the auth header as a redaction placeholder that identifies extension
  and profile but not the value.
- `--dry-run` output for an authenticated call shows the redaction placeholder; for
  an unauthenticated call it shows `[missing]` and exits 0.
- An HTTP 401 from a provider produces an error message that includes the status and
  a hint to re-run `godmode auth login`, and does not include the credential that
  was sent.
- No trace record (0700) or history-visible artifact (0600) produced during an
  authenticated call contains the credential value, verified by searching the shared
  store for the known test secret.
- `godmode auth login stripe` invoked from within an orchestrated agent run is
  refused with a message stating that credential provisioning is a human-only step,
  and exits non-zero.
- When the OS keychain denies access, the resulting error distinguishes "keychain
  access denied" from "no credential stored" and suggests unlocking the keychain
  rather than re-running login.
