# godmode

any API as CLI. any API as MCP. zero code generation.

## Install

```sh
npm install -g godmode
```

## Usage

```sh
godmode ext install stripe
godmode stripe api customers cus_123
godmode stripe mcp                # serve as MCP server
```

Run `godmode --help` or `godmode <extension> --help` at any nesting level for usage.

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

See [documentation](https://docs.godmode.so) for more.
