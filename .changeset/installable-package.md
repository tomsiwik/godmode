---
"godmode": patch
---

Fix installation from npm: the bundled workspace packages are no longer published as dependencies, which made `npm install godmode` fail with a 404 since 0.0.2.
