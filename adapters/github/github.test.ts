import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testAdapter } from '@godmode-cli/test';

testAdapter('github', resolve(dirname(fileURLToPath(import.meta.url)), 'manifest.test.yaml'));
