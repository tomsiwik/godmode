# godmode

any API as CLI. any API as MCP. zero code generation.

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

See [documentation](https://docs.godmode.so) for more.
