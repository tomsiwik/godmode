import { loadSettingsDetailed, settingsErrorMessage, type PermissionRule } from './settings.js';

/**
 * Permission evaluation.
 *
 *   permissions:
 *     allow:
 *       - resources: [customers.*]   # `*` is a segment-aware glob
 *         methods:   [GET, POST]     # omit for any method
 *     deny:
 *       - resources: [account]
 *
 * Rules:
 *   - No `permissions` block → allow all (opt-in).
 *   - Block present → default deny. An action must match an `allow`.
 *   - A matching `deny` always wins, regardless of allows.
 *   - `resources` defaults to `['*']` when omitted. Empty array matches
 *     nothing, not everything — an explicit empty list is a typo guard.
 */

export interface CheckResult {
  allowed: boolean;
  /** Non-null when `allowed: false` — explains the decision. */
  reason?: string;
  rule?: PermissionRule;
  origin?: string;
  defaultDenied?: boolean;
}

export interface CheckInput {
  /** Extension slug as declared in its manifest. */
  extension: string;
  /** Dot-joined static resource path (params skipped), e.g.
   *  `customers.balance_transactions`. Use `resourceFromRoute` to derive. */
  resource: string;
  /** HTTP method, MCP tool name, or any other per-action identifier. */
  method: string;
}

export function checkPermission(input: CheckInput): CheckResult {
  const loaded = loadSettingsDetailed();
  const settingsError = loaded.errors[0];
  if (settingsError) {
    return {
      allowed: false,
      reason: settingsErrorMessage(settingsError),
      defaultDenied: true,
    };
  }

  const blocks = loaded.sources
    .map((source) => ({
      origin: `${source.scope}:${source.path}`,
      permissions: source.settings.extensions?.[input.extension]?.permissions,
    }))
    .filter((source) => !!source.permissions);

  const hasAny = blocks.some(({ permissions }) => !!(permissions?.allow?.length || permissions?.deny?.length));
  if (!hasAny) return { allowed: true };

  for (const block of blocks) {
    for (const rule of block.permissions?.deny ?? []) {
      if (ruleMatches(rule, input)) {
        return {
          allowed: false,
          reason: `denied by permissions for ${input.extension}: ${describe(rule, input, 'deny')}`,
          rule,
          origin: block.origin,
        };
      }
    }
  }
  for (const block of blocks) {
    for (const rule of block.permissions?.allow ?? []) {
      if (ruleMatches(rule, input)) return { allowed: true, rule, origin: block.origin };
    }
  }
  return {
    allowed: false,
    reason: `no allow rule matches ${input.resource} ${input.method.toUpperCase()} for ${input.extension}`,
    defaultDenied: true,
  };
}

export function explainPermission(input: CheckInput): CheckResult & { input: CheckInput } {
  return { ...checkPermission(input), input };
}

export function suggestedAllowRule(input: CheckInput): string {
  return [
    'permissions:',
    '  allow:',
    `    - resources: [${input.resource}]`,
    `      methods: [${input.method.toUpperCase()}]`,
  ].join('\n');
}

// ── helpers ──────────────────────────────────────────────────

function ruleMatches(rule: PermissionRule, input: CheckInput): boolean {
  const resources = rule.resources ?? ['*'];
  const resourceOk = resources.some((pattern) => matchResource(pattern, input.resource));
  if (!resourceOk) return false;
  if (!rule.methods || rule.methods.length === 0) return true;
  return rule.methods.some((m) => m.toLowerCase() === input.method.toLowerCase());
}

function matchResource(pattern: string, resource: string): boolean {
  if (pattern === '*' || pattern === resource) return true;
  const pp = pattern.split('.');
  const rp = resource.split('.');
  // Trailing `*` covers remaining segments (prefix glob).
  if (pp[pp.length - 1] === '*' && rp.length >= pp.length) {
    for (let i = 0; i < pp.length - 1; i++) {
      if (pp[i] !== '*' && pp[i] !== rp[i]) return false;
    }
    return true;
  }
  // Exact-length match with per-segment wildcard.
  if (pp.length !== rp.length) return false;
  for (let i = 0; i < pp.length; i++) {
    if (pp[i] !== '*' && pp[i] !== rp[i]) return false;
  }
  return true;
}

function describe(rule: PermissionRule, input: CheckInput, effect: 'allow' | 'deny'): string {
  const res = (rule.resources ?? ['*']).join(', ');
  const mth = rule.methods?.join(', ') || 'any method';
  return `${effect} ${res} [${mth}] while acting on ${input.resource} ${input.method.toUpperCase()}`;
}

// ── adapters to derive `resource` from manifest data ─────────

/** Build a dotted resource path from a route's static segments (params
 *  skipped). `/v1/customers/{customer}/balance_transactions` → `customers.balance_transactions`.
 *  Version prefixes (v1, v2, …) are treated as noise and stripped. */
export function resourceFromSegments(segments: Array<{ value: string; isParam: boolean }>): string {
  const parts = segments
    .filter((s) => !s.isParam)
    .map((s) => s.value)
    .filter((v) => !/^v\d+$/i.test(v));
  return parts.join('.') || '*';
}

/** MCP tool names are already flat; use as-is. */
export function resourceFromTool(toolName: string): string {
  return toolName;
}

export function resourceFromRawPath(path: string): string {
  const parts = path
    .split('/')
    .filter(Boolean)
    .filter((v) => !/^v\d+$/i.test(v));
  return parts.join('.') || '*';
}
