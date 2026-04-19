// Pure rule checks for GNU --help / --version compliance.
// Each rule is a function (text: string) => { ok, message? }.
// Catalog derived from utils/RULES.md.

export type RuleResult = { ok: true } | { ok: false; message: string };

export interface Rule {
  id: string;
  source: 'help2man' | 'mandoc' | 'gnu-cs';
  severity: 'error' | 'warning' | 'style';
  rationale: string;
  check: (text: string) => RuleResult;
}

const pass: RuleResult = { ok: true };
const fail = (message: string): RuleResult => ({ ok: false, message });

// ── help2man format requirements (from help2man.PL:400–620) ──

const usageLine: Rule = {
  id: 'help2man/usage-line',
  source: 'help2man',
  severity: 'error',
  rationale: 'help2man promotes "Usage:" to SYNOPSIS (help2man.PL $PAT_USAGE).',
  check: (t) =>
    /^Usage:\s+\S/m.test(t) ? pass : fail('no "Usage: <prog>" line found'),
};

const usageContinuation: Rule = {
  id: 'help2man/usage-or',
  source: 'help2man',
  severity: 'style',
  rationale: 'Alternate usages use "  or:" continuation (help2man.PL $PAT_USAGE_CONT).',
  check: (t) => {
    const lines = t.split('\n');
    const usageIdx = lines.findIndex((l) => /^Usage:/.test(l));
    if (usageIdx === -1) return pass;
    const next = lines[usageIdx + 1];
    if (!next || /^\s*$/.test(next)) return pass;
    if (/^\s*or:\s+\S/.test(next) || /^\S/.test(next)) return pass;
    return fail(`line after "Usage:" must be "   or:" or blank, got: ${JSON.stringify(next)}`);
  },
};

const optionIndent: Rule = {
  id: 'help2man/option-indent',
  source: 'help2man',
  severity: 'error',
  rationale: 'Option lines must start with 1–10 spaces then a flag (help2man.PL option regex).',
  check: (t) => {
    const inOptions = t.split(/\n/).slice(
      Math.max(0, t.split('\n').findIndex((l) => /^Options:\s*$/.test(l))),
    );
    const flagLine = /^ {1,10}[-+]\S/;
    const bad = inOptions.find((l) => /^\s+-[-\w]/.test(l) && !flagLine.test(l));
    return bad ? fail(`option line has wrong indent: ${JSON.stringify(bad)}`) : pass;
  },
};

const optionDescSeparation: Rule = {
  id: 'help2man/option-desc-separation',
  source: 'help2man',
  severity: 'error',
  rationale:
    'At least two spaces separate the flag group from its description (help2man.PL option regex, `  +(?!-)`).',
  check: (t) => {
    // Flag line heuristic: starts with 1–10 spaces, then a flag (-short or --long).
    // A line that has any description at all must also contain a 2+-space gap.
    // Single-spaced "flag desc" patterns are indistinguishable from flag-with-arg
    // (e.g., `--file FILE`), so we only flag lines that clearly have multi-word
    // descriptions: 3+ whitespace-separated tokens after the flag group, with
    // no 2+-space gap anywhere.
    const bad = t.split('\n').find((l) => {
      if (!/^ {1,10}-/.test(l)) return false;
      if (/  +\S/.test(l)) return false; // has a 2+-space gap → OK
      const after = l.replace(/^ {1,10}/, '').trim();
      // 3+ tokens without any 2+-space gap = probably single-spaced description
      return after.split(/\s+/).length >= 3;
    });
    return bad ? fail(`flag/description gap <2 spaces: ${JSON.stringify(bad)}`) : pass;
  },
};

const reportBugs: Rule = {
  id: 'help2man/report-bugs',
  source: 'help2man',
  severity: 'warning',
  rationale: 'help2man maps "Report bugs" to REPORTING BUGS section (help2man.PL $PAT_BUGS).',
  check: (t) =>
    /^Report +(?:[\w-]+ +)?bugs\b/m.test(t) || /^Email +bug +reports +to\b/m.test(t)
      ? pass
      : fail('no "Report bugs to …" line found'),
};

// ── mandoc rules that can fire on our generated man page (utils/RULES.md §1) ──

const noLongLines: Rule = {
  id: 'mandoc/TEXT_LONG',
  source: 'mandoc',
  severity: 'style',
  rationale: 'MANDOCERR_TEXT_LONG: input text line longer than 80 bytes.',
  check: (t) => {
    const bad = t.split('\n').find((l) => l.length > 80);
    return bad
      ? fail(`line >80 bytes (${bad.length}): ${JSON.stringify(bad.slice(0, 90))}`)
      : pass;
  },
};

const noTrailingWhitespace: Rule = {
  id: 'mandoc/SPACE_EOL',
  source: 'mandoc',
  severity: 'style',
  rationale: 'MANDOCERR_SPACE_EOL: whitespace at end of input line.',
  check: (t) => {
    const lines = t.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/[ \t]+$/.test(lines[i])) {
        return fail(`trailing whitespace on line ${i + 1}`);
      }
    }
    return pass;
  },
};

const asciiOnly: Rule = {
  id: 'mandoc/CHAR_BAD',
  source: 'mandoc',
  severity: 'warning',
  rationale: 'MANDOCERR_CHAR_BAD + MANDOCERR_ESC_UNDEF: non-ASCII chars render unreliably.',
  check: (t) => {
    const lines = t.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/[^\x09\x0a\x20-\x7e]/);
      if (m) {
        return fail(
          `non-ASCII U+${m[0].codePointAt(0)!.toString(16).padStart(4, '0').toUpperCase()} on line ${i + 1}`,
        );
      }
    }
    return pass;
  },
};

const noAnsi: Rule = {
  id: 'mandoc/no-ansi',
  source: 'mandoc',
  severity: 'error',
  rationale: 'ANSI escape sequences break help2man/mandoc parsing.',
  check: (t) => (/\x1b\[[0-9;]*m/.test(t) ? fail('ANSI escape sequences present') : pass),
};

// ── GNU Coding Standards (§ "Command-Line Interfaces") ──

const hasHomePage: Rule = {
  id: 'gnu-cs/home-page',
  source: 'gnu-cs',
  severity: 'style',
  rationale: 'GNU programs should list their home page URL.',
  check: (t) =>
    /home page:/i.test(t) ? pass : fail('no "home page:" line found'),
};

const bugsUrl: Rule = {
  id: 'gnu-cs/bugs-address',
  source: 'gnu-cs',
  severity: 'warning',
  rationale: 'Report-bugs line should carry a URL or email.',
  check: (t) => {
    const m = t.match(/^Report +(?:[\w-]+ +)?bugs +to\s+(.+?)\.?\s*$/m);
    if (!m) return pass; // handled by reportBugs rule
    const addr = m[1];
    return /<?https?:\/\//.test(addr) || /<?[^\s<]+@[^\s>]+/.test(addr)
      ? pass
      : fail(`bugs address not URL/email: ${JSON.stringify(addr)}`);
  },
};

// ── --version specific rules ──

const versionFirstLine: Rule = {
  id: 'gnu-cs/version-first-line',
  source: 'gnu-cs',
  severity: 'error',
  rationale: 'First line of --version must be "<name> <version>" (help2man extracts program name from it).',
  check: (t) => {
    const first = t.split('\n')[0] ?? '';
    return /^\S+\s+\S+/.test(first)
      ? pass
      : fail(`first line doesn't match "<name> <version>": ${JSON.stringify(first)}`);
  },
};

const versionCopyright: Rule = {
  id: 'gnu-cs/version-copyright',
  source: 'gnu-cs',
  severity: 'warning',
  rationale: 'GNU --version output includes a Copyright line.',
  check: (t) =>
    /^Copyright\b/m.test(t) ? pass : fail('no Copyright line in --version output'),
};

const versionLicense: Rule = {
  id: 'gnu-cs/version-license',
  source: 'gnu-cs',
  severity: 'style',
  rationale: 'GNU --version output names the license.',
  check: (t) => (/License\b/i.test(t) ? pass : fail('no License line in --version output')),
};

const hasOptionsSection: Rule = {
  id: 'gnu-cs/options-section',
  source: 'gnu-cs',
  severity: 'warning',
  rationale: 'Every help page lists flags (including --help and --version) under "Options:".',
  check: (t) =>
    /^Options:\s*$/m.test(t) ? pass : fail('no "Options:" section found'),
};

const optionsContainsHelp: Rule = {
  id: 'gnu-cs/options-has-help',
  source: 'gnu-cs',
  severity: 'warning',
  rationale: 'Every help page should advertise its own --help flag.',
  check: (t) =>
    /^ {1,10}-h, --help\b/m.test(t) ? pass : fail('help pages must list "-h, --help"'),
};

// ── rule sets ──

// Shared rules: every help page must satisfy these.
const baseHelpRules: Rule[] = [
  usageLine,
  usageContinuation,
  optionIndent,
  optionDescSeparation,
  noLongLines,
  noTrailingWhitespace,
  asciiOnly,
  noAnsi,
];

// Root help: canonical GNU layout — has Options (-v), bugs, homepage.
// `-h, --help` is intentionally not documented; it's universally known and
// parsed regardless, so documenting it is noise.
export const rootHelpRules: Rule[] = [
  ...baseHelpRules,
  hasOptionsSection,
  reportBugs,
  hasHomePage,
  bugsUrl,
];

// Sub-help: -h/-v are inherited from root, not re-listed. Options section is
// optional (some pages have context-specific flags, others — like `ext --help`
// — have no flags at all).
export const subHelpRules: Rule[] = baseHelpRules;

export const versionRules: Rule[] = [versionFirstLine, versionCopyright, versionLicense];

// ── runner ──

export function runRules(rules: Rule[], text: string) {
  return rules.map((r) => ({ rule: r, result: r.check(text) }));
}
