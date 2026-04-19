<p align="center">
  <img src="assets/godmode-pixels.svg" alt="godmode" width="360" />
</p>

<p align="center">
  Agent sandboxed? Give it this tool only `Bash(godmode:*)` for save plug & play extensions
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/godmode"><img src="https://img.shields.io/npm/v/godmode?style=flat-square&color=blue" alt="npm" /></a>
  <a href="https://github.com/tomsiwik/godmode/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT" /></a>
</p>

<p align="center">
  <a href="https://docs.godmode.so">Documentation</a> &middot; <a href="https://godmode.so/extensions">Extensions</a>
</p>

---

Imagine your coding agent gets dropped on a desert island and is allowed to bring one thing. What would it pick? A Swiss Army knife, obviously. The terminal is that island — sometimes it's a bare, lonely sandbox with nothing on it, sometimes it's a rich setup like a Mac Studio with everything you could want. But as long as the agent has a knife it can pull any tool out of, it'll be fine. That knife is godmode.

## Install

```sh
npm install -g godmode
```

## Usage

```sh
godmode extension add stripe
godmode api stripe customers cus_123
godmode mcp stripe
```

## Claude Code

```json
{
  "mcpServers": {
    "stripe": {
      "command": "godmode",
      "args": ["mcp", "stripe"]
    }
  }
}
```

## Custom Extensions

```yaml
# manifest.yaml
name: My Extension
slug: my-extension
interfaces:
  api:
    spec: https://example.com/openapi.json
    url: https://api.example.com
auth:
  env: MY_API_KEY
  type: bearer                         # bearer | api-key | basic (default: bearer)
```

```sh
godmode ext install ./my-extension
```

### Authentication types

Godmode supports three credential conventions. The `type` field decides **where on the wire** the value from `auth.env` is sent:

| `type`    | HTTP header                         | curl equivalent                                 | when to use |
|-----------|-------------------------------------|-------------------------------------------------|-------------|
| `bearer`  | `Authorization: Bearer <token>`     | `curl -H "Authorization: Bearer $TOKEN"`        | OAuth 2.0–style APIs (Stripe, GitHub, OpenAI, Slack) |
| `api-key` | `<header>: <token>`                 | `curl -H "X-API-Key: $KEY"`                     | custom-header schemes; set `auth.header` to the header name (defaults to `X-API-Key`) |
| `basic`   | `Authorization: Basic <credential>` | `curl -u user:password`                         | legacy APIs; the env var should hold base64-encoded `user:password` |

Examples:

```yaml
# Bearer (default)
auth:
  env: STRIPE_API_KEY

# API key in a custom header
auth:
  env: SENDGRID_API_KEY
  type: api-key
  header: X-API-Key

# Basic auth
auth:
  env: WP_CREDS                        # raw value: base64("user:password")
  type: basic
```

Running `godmode <extension> <interface> --help` shows `--> <ENV>: missing <type> …` at the top when the credential isn't set, with the wording matching the declared type.
