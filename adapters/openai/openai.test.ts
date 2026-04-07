import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testAdapter } from 'godmode/test/adapter';

testAdapter('openai', resolve(dirname(fileURLToPath(import.meta.url)), 'manifest.yaml'));
