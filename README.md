<p align="center">
  <img src="assets/logo.svg?sanitize=1" alt="godmode" width="100" height="100" />
</p>

<h2 align="center">Godmode</h2>

<p align="center">
  better than mcp
</p>

<p align="center">
  <a href="https://img.shields.io/badge/node-20+-green?style=flat-square&logo=node.js&logoColor=white"><img src="https://img.shields.io/badge/node-20+-green?style=flat-square&logo=node.js&logoColor=white" alt="Node" /></a>
</p>

<p align="center">
  <a href="https://github.com/tomsiwik/godmode/issues">Issues</a>
</p>

## Introduction

Turn any OpenAPI spec into a CLI. 5 lines of YAML, zero code generation.

```
godmode stripe --help

Stripe v2026-02-25.clover
godmode enabled (API->CLI) command-line tool to interact with Stripe.

Usage:
  godmode stripe <resource> [id] [flags]

Auth: bearer via STRIPE_API_KEY

Resources:
  account                     (get)
  accounts                    (list, create, get, update, delete)
  customers                   (list, create, get, update, delete)
  charges                     (list, create, get, update)
  ...                         72 more — run "godmode stripe <resource> --help"
```

## Table of Contents

- [Getting Started](#getting-started)
- [Adapters](#adapters)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

```sh
npm install -g godmode
```

Create a config or use the interactive wizard:

```sh
godmode create
```

Or write one manually:

```yaml
# stripe.yaml
name: Stripe
description: godmode enabled (API->CLI) command-line tool to interact with Stripe.
type: api
spec: https://raw.githubusercontent.com/stripe/openapi/.../openapi.spec3.yaml
url: https://api.stripe.com
auth:
  env: STRIPE_API_KEY
```

```sh
godmode add stripe
godmode stripe --help
```

## Adapters

Built-in configs in `apis/`:

| API | Routes | Auth |
|-----|--------|------|
| Stripe | 616 | Bearer |
| GitHub | 1,093 | Bearer |
| OpenAI | 148 | Bearer |
| Slack | 174 | Bearer |
| Petstore | 19 | None |

## Usage

```sh
godmode stripe customers                          # List
godmode stripe customers cus_123                  # Get
godmode stripe customers --post -q email=a@b.com  # Create
godmode stripe customers cus_123 -d               # Delete
godmode stripe /v1/customers                      # Raw path
```

Navigate with `--help` at any level:

```sh
godmode stripe --help                             # Resources, auth, usage
godmode stripe customers --help                   # Operations & sub-resources
godmode stripe customers balance_transactions --help
```

Auth via `.env`:

```sh
echo "STRIPE_API_KEY=sk_test_..." > .env
godmode stripe account
```

Full reference:

```
Usage:
  godmode <api> <resource> [id] [flags]
  godmode <api> /path [flags]

Setup:
  create                      Create own custom API entrypoint
  add <name|file>             Add API as CLI command from <name>.yaml config
  update <name>               Re-fetch OpenAPI spec and rebuild routes
  remove <name>               Unregister an API
  list                        Show all registered APIs

Flags:
      --post                  POST
      --put                   PUT
      --patch                 PATCH
  -d, --delete                DELETE
  -q  <key=value>             Query (GET) or body (POST/PUT/PATCH)
  -H  <key:value>             Add header
      --token <tok>            Auth token (overrides config)
      --dry-run                Preview request without sending
  -v, --verbose                Show full request/response
```

## Development

```sh
pnpm install
pnpm build
pnpm test
```

Adding a new adapter:

```sh
mkdir apis/myapi
```

```yaml
# apis/myapi/myapi.yaml
name: MyAPI
type: api
spec: https://example.com/openapi.json
url: https://api.example.com
```

```ts
// apis/myapi/myapi.test.ts
import { describeAdapter } from '../../test/adapter';
describeAdapter('myapi', 'apis/myapi/myapi.yaml');
```

## Contributing

Contributions of all sizes are welcome.

<a href="https://github.com/tomsiwik/godmode/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tomsiwik/godmode" />
</a>

## License

[MIT](./LICENSE)

<br />

<p align="center">Made with &#x2764;&#xFE0F; by <a href="https://github.com/tomsiwik">tomsiwik</a></p>
