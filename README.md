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
godmode ext install stripe
godmode stripe api customers cus_123
godmode stripe mcp                       # serve as MCP server
```

Everything is self-describing via `--help` at any nesting level:

```sh
godmode --help                           # interfaces + built-in extensions
godmode <extension> --help               # declared interfaces
godmode <extension> <interface> --help   # methods, resources, options
godmode <extension> <interface> <resource> --help
```

## Claude Code

```json
{
  "mcpServers": {
    "stripe": {
      "command": "godmode",
      "args": ["stripe", "mcp"]
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
  type: bearer          # bearer | api-key | basic
```

```sh
godmode ext install ./my-extension
godmode my-extension api --help
```

`auth.type` picks where on the wire the credential goes: `bearer` → `Authorization: Bearer <env>`, `api-key` → custom header (`auth.header`, defaults to `X-API-Key`), `basic` → `Authorization: Basic <env>` (env holds `base64(user:password)`). When the credential is missing, `--help` surfaces `--> <ENV>: missing <type>` at the top of the page with wording matching the declared type.
