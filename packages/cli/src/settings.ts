import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { parse as parseYaml } from 'yaml';

/**
 * Project- and global-scoped config. Structured YAML at:
 *
 *   <cwd>/.godmode/settings.yaml       (project, overlay)
 *   ~/.godmode/settings.yaml           (global, base)
 *
 * Shape (permissions only, for now):
 *
 *   extensions:
 *     stripe:
 *       permissions:
 *         allow:
 *           - resources: [customers.*, charges]
 *             methods:   [GET, POST]
 *         deny:
 *           - resources: [account]
 *
 * `resources` defaults to `['*']` when omitted; `methods` defaults to
 * "any method". Document exceptions with a YAML comment (`#`) on the
 * rule itself — the loader retains the rule either way.
 */

export interface PermissionRule {
  /** Dotted resource patterns. `*` is a segment-aware glob. Defaults to `['*']`. */
  resources?: string[];
  /** HTTP methods (API) or dispatch verbs (MCP). Omitted → any method. */
  methods?: string[];
}

export interface PermissionBlock {
  allow?: PermissionRule[];
  deny?: PermissionRule[];
}

export interface ExtensionSettings {
  permissions?: PermissionBlock;
}

export interface Settings {
  extensions?: Record<string, ExtensionSettings>;
}

// ── resolution ───────────────────────────────────────────────

function findProjectGodmode(start: string = process.cwd()): string | null {
  let dir = resolve(start);
  while (true) {
    const candidate = resolve(dir, '.godmode');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
}

function readSettingsFile(path: string): Settings {
  if (!existsSync(path)) return {};
  try {
    const raw = parseYaml(readFileSync(path, 'utf-8'));
    return (raw ?? {}) as Settings;
  } catch (e: unknown) {
    const msg = (e as { message?: string }).message || String(e);
    process.stderr.write(`Warning: could not parse ${path}: ${msg}\n`);
    return {};
  }
}

// ── merge ────────────────────────────────────────────────────

function mergePermissions(
  base: PermissionBlock = {},
  overlay: PermissionBlock = {},
): PermissionBlock | undefined {
  const allow = [...(base.allow ?? []), ...(overlay.allow ?? [])];
  const deny = [...(base.deny ?? []), ...(overlay.deny ?? [])];
  if (!allow.length && !deny.length) return undefined;
  const merged: PermissionBlock = {};
  if (allow.length) merged.allow = allow;
  if (deny.length) merged.deny = deny;
  return merged;
}

function mergeExtension(base: ExtensionSettings = {}, overlay: ExtensionSettings = {}): ExtensionSettings {
  const merged: ExtensionSettings = { ...base, ...overlay };
  const permissions = mergePermissions(base.permissions, overlay.permissions);
  if (permissions) merged.permissions = permissions;
  return merged;
}

function mergeSettings(base: Settings, overlay: Settings): Settings {
  const extensions: Record<string, ExtensionSettings> = {};
  const slugs = new Set([
    ...Object.keys(base.extensions ?? {}),
    ...Object.keys(overlay.extensions ?? {}),
  ]);
  for (const slug of slugs) {
    extensions[slug] = mergeExtension(
      base.extensions?.[slug],
      overlay.extensions?.[slug],
    );
  }
  return { extensions };
}

// ── public loader ────────────────────────────────────────────

let cached: Settings | null = null;

export function loadSettings(): Settings {
  if (cached) return cached;
  const globalPath = resolve(homedir(), '.godmode', 'settings.yaml');
  const projectRoot = findProjectGodmode();
  const projectPath = projectRoot ? resolve(projectRoot, 'settings.yaml') : null;

  const globalSettings = readSettingsFile(globalPath);
  const projectSettings = projectPath ? readSettingsFile(projectPath) : {};
  cached = mergeSettings(globalSettings, projectSettings);
  return cached;
}

/** For tests — clear memoized settings between fixture setups. */
export function resetSettingsCache(): void {
  cached = null;
}

export function extensionSettings(slug: string): ExtensionSettings {
  const s = loadSettings();
  return s.extensions?.[slug] ?? {};
}
