import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Load .env from cwd into process.env (does not override existing vars) */
export function loadEnv() {
  let text: string;
  try {
    text = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  } catch {
    return;
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
