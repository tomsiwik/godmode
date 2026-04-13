import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { HARNESSES } from '../src/index.js';

function help(command: string) {
  return spawnSync(command, ['--help'], { encoding: 'utf-8' });
}

describe.each(Object.values(HARNESSES))('%s help discovery', (harness) => {
  const result = help(harness.command);
  const installed = !result.error && result.status === 0;
  const maybeIt = installed ? it : it.skip;

  maybeIt('advertises an expected model flag', () => {
    const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
    expect(harness.modelFlags.some((flag) => text.includes(flag.toLowerCase()))).toBe(true);
  });

  maybeIt('advertises expected effort flags when supported', () => {
    if (harness.effortFlags.length === 0) return;
    const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
    expect(harness.effortFlags.some((flag) => text.includes(flag.toLowerCase()))).toBe(true);
  });

  maybeIt('advertises prompt/input usage', () => {
    const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
    expect(harness.promptHints.some((hint) => text.includes(hint.toLowerCase()))).toBe(true);
  });
});
