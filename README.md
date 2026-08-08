<p align="center">
  <img src="assets/godmode-pixels.svg" alt="godmode" width="360" />
</p>

<p align="center">
  Your agent's Swiss Army knife for the terminal.
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

## What it does

godmode is a local capability runtime with one CLI grammar for everything you install — APIs, MCP servers, and local commands. Each of those is an extension, and they all take the same shape:

```sh
godmode [extension] [interface] [args]
```

The runtime is designed to put policy, credentials, and audit around every capability invocation: a Stripe extension can hide account edits, a filesystem extension can restrict paths, and a database extension can forbid writes. When the surrounding agent host enforces a safe command boundary, one `godmode` command permission can expose that governed toolbelt without registering each source capability separately.

```sh
npm install -g godmode
godmode ext install stripe
godmode stripe api GET customers cus_123
godmode stripe mcp                          # serve over MCP
```

See the [docs](https://godmode.so) for installation, the full grammar, authentication, and integrations.
