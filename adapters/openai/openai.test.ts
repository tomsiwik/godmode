import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testAdapter } from '@godmode-cli/cli/test/adapter';

testAdapter('openai', resolve(dirname(fileURLToPath(import.meta.url)), 'manifest.yaml'));
