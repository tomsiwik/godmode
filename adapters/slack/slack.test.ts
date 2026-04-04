import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testAdapter } from '@godmode-cli/godmode/test/adapter';

testAdapter('slack', resolve(dirname(fileURLToPath(import.meta.url)), 'manifest.yaml'));
