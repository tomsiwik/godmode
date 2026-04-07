<p align="center">
  <img src="assets/logo.svg?sanitize=1" alt="godmode" width="100" height="100" />
</p>

<h2 align="center">Godmode</h2>

<p align="center">
  any API as CLI. any API as MCP. zero code generation.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/godmode"><img src="https://img.shields.io/npm/v/godmode?style=flat-square&color=blue" alt="npm" /></a>
  <a href="https://github.com/tomsiwik/godmode/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT" /></a>
</p>

<p align="center">
  <a href="https://docs.godmode.so">Documentation</a> &middot; <a href="https://godmode.so/adapters">Adapters</a>
</p>

---

## Install

```sh
npm install -g godmode
```

## Usage

```sh
godmode add stripe
godmode stripe customers cus_123
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

## Custom Adapters

```yaml
# manifest.yaml
slug: my-adapter
name: My Adapter
type: api                              # api | graphql | mcp
spec: https://example.com/openapi.json
url: https://api.example.com
auth:
  env: MY_API_KEY
```

```sh
godmode add ./my-adapter
```
