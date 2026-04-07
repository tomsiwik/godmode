import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testAdapter } from '@godmode-cli/testing';

testAdapter('stripe', resolve(dirname(fileURLToPath(import.meta.url)), 'manifest.yaml'));
