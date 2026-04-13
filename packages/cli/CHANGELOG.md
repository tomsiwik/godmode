# godmode

## 0.0.2

### Patch Changes

- Add a harness-agnostic `godmode agent` workflow powered by native coding CLIs with persistent zmx sessions, structured per-turn output capture, normalized events, resume/continue support, and project/global settings for harness, model, and effort.

## 0.0.1

### Initial Release

- Register APIs from YAML config (`godmode add`)
- Interactive wizard (`godmode create`)
- CRUD via flags: `-q` for params, `-d` for delete, `--post` for create
- Navigate with `--help` at any level
- Raw path mode (`godmode stripe /v1/customers`)
- Version-transparent routing (auto-detects `/v1`, `/v2` prefixes)
- Auth via `.env` with configurable env var names
- Adapters: Stripe, GitHub, OpenAI, Slack, Petstore
