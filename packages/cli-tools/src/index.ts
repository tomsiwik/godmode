// Shared CLI primitives used by the godmode CLI and built-in commands
// (e.g. @godmode-cli/command-agent). Keep this package small and free of
// manifest/spec types so anything that renders help can depend on it
// without pulling in the whole CLI.

// ── ANSI color helpers ──────────────────────────────────────

export const USE_COLOR = process.stdout.isTTY;
export const DIM = USE_COLOR ? '\x1b[2m' : '';
export const ITALIC = USE_COLOR ? '\x1b[3m' : '';
export const RESET = USE_COLOR ? '\x1b[0m' : '';
export const GREEN = USE_COLOR ? '\x1b[32m' : '';
export const RED = USE_COLOR ? '\x1b[31m' : '';

export function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

export function wrapText(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!line) { line = word; continue; }
    if (line.length + 1 + word.length <= width) {
      line += ' ' + word;
    } else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

// ── sections ────────────────────────────────────────────────

export interface HelpSection {
  title: string;
  /** Rows as string[][]. All columns except the last are treated as "left".
   *  Last column is the description (flexible, wraps). Empty arrays render no header. */
  rows: string[][];
}

/**
 * Render multiple sections with flexbox-like alignment:
 *   - Within each section, non-last columns align locally.
 *   - Across all sections, the boundary between left-blob and description
 *     is at the same column (global max).
 *   - The description column auto-wraps to respect maxLineWidth.
 */
export function renderSections(sections: HelpSection[], maxLineWidth = 80) {
  const INDENT = '  ';
  const GAP = '  ';

  const flattened = sections.map((s) => {
    if (!s.rows.length) return { title: s.title, rows: [] as Array<[string, string]> };
    const cols = Math.max(...s.rows.map((r) => r.length));
    const widths = Array<number>(cols).fill(0);
    for (const row of s.rows) {
      for (let i = 0; i < cols; i++) {
        widths[i] = Math.max(widths[i], visibleLength(row[i] ?? ''));
      }
    }
    const rows: Array<[string, string]> = s.rows.map((row) => {
      const left = row
        .slice(0, cols - 1)
        .map((cell, i) => (cell ?? '') + ' '.repeat(widths[i] - visibleLength(cell ?? '')))
        .join(GAP)
        .replace(/\s+$/, '');
      const desc = row[cols - 1] ?? '';
      return [left, desc];
    });
    return { title: s.title, rows };
  });

  const allRows = flattened.flatMap((s) => s.rows);
  if (!allRows.length) return;
  const rowsWithDesc = allRows.filter((r) => r[1].length > 0);
  const widthCandidates = (rowsWithDesc.length ? rowsWithDesc : allRows).map((r) => visibleLength(r[0]));
  const globalLeft = Math.max(...widthCandidates);
  const descBudget = Math.max(20, maxLineWidth - INDENT.length - globalLeft - GAP.length);

  for (const s of flattened) {
    if (!s.rows.length) continue;
    if (s.title) {
      console.log('');
      console.log(s.title);
    }
    for (const [left, desc] of s.rows) {
      const pad = ' '.repeat(Math.max(0, globalLeft - visibleLength(left)));
      const plain = desc.replace(/\x1b\[[0-9;]*m/g, '');
      if (!plain) {
        console.log(`${INDENT}${left}${pad}`.trimEnd());
        continue;
      }
      if (plain.length <= descBudget) {
        console.log(`${INDENT}${left}${pad}${GAP}${desc}`);
        continue;
      }
      const italic = /^\x1b\[3m/.test(desc);
      const wrap = (s: string) => (italic ? `${ITALIC}${s}${RESET}` : s);
      const lines = wrapText(plain, Math.max(10, descBudget));
      console.log(`${INDENT}${left}${pad}${GAP}${wrap(lines[0])}`);
      for (let i = 1; i < lines.length; i++) {
        console.log(`${INDENT}${' '.repeat(Math.max(0, globalLeft))}${GAP}${wrap(lines[i])}`);
      }
    }
  }
}

/** Back-compat single-table wrapper. */
export function printTable(rows: string[][], opts: { maxLineWidth?: number } = {}) {
  renderSections([{ title: '', rows }], opts.maxLineWidth);
}

// ── auth ─────────────────────────────────────────────────────

export { AuthStrategy } from './auth.js';
export type { AuthConfig, AuthType } from './auth.js';
import { AuthStrategy as _AuthStrategy, type AuthType as _AuthType } from './auth.js';

export interface AuthNote {
  env: string;
  authType: _AuthType;
  present: boolean;
}

/** Retained for back-compat; delegates to the strategy's missingMessage(). */
export function authMissingLabel(type?: string): string {
  return _AuthStrategy.for({ type: type as _AuthType | undefined }).missingMessage();
}

// ── HelpPage ────────────────────────────────────────────────

export interface Footer {
  reportBugs?: string;
  homepage?: string;
  /** Free-form lines rendered before the report-bugs/homepage block. */
  extras?: string[];
}

export interface HelpPageData {
  title: string | null;
  tagline: string | null;
  authNote: AuthNote | null;
  usage: string[];
  sections: HelpSection[];
  footer: Footer | null;
}

/**
 * Base help page. Subclasses override the hooks to declare what to show;
 * render() walks them in a consistent order. toJSON() returns the whole
 * page as structured data — useful for machine-readable export or tests.
 */
export abstract class HelpPage {
  title(): string | null { return null; }
  tagline(): string | null { return null; }
  authNote(): AuthNote | null { return null; }
  usage(): string[] { return []; }
  sections(): HelpSection[] { return []; }
  footer(): Footer | null { return null; }

  toJSON(): HelpPageData {
    return {
      title: this.title(),
      tagline: this.tagline(),
      authNote: this.authNote(),
      usage: this.usage(),
      sections: this.sections(),
      footer: this.footer(),
    };
  }

  render(): void {
    const d = this.toJSON();
    let wrote = false;
    if (d.title) { console.log(d.title); wrote = true; }
    if (d.tagline) {
      if (wrote) console.log('');
      console.log(d.tagline);
      wrote = true;
    }
    if (d.authNote && !d.authNote.present) {
      const arrow = USE_COLOR ? `${RED}-->${RESET}` : '-->';
      const label = authMissingLabel(d.authNote.authType);
      const body = USE_COLOR ? `${RED}${label}${RESET}` : label;
      if (wrote) console.log('');
      console.log(`${arrow} ${d.authNote.env}: ${body}`);
      wrote = true;
    }
    if (d.usage.length) {
      if (wrote) console.log('');
      for (let i = 0; i < d.usage.length; i++) {
        const prefix = i === 0 ? 'Usage:' : '   or:';
        console.log(`${prefix} ${d.usage[i]}`);
      }
      wrote = true;
    }
    renderSections(d.sections);
    if (d.footer) {
      if (d.footer.extras?.length) {
        console.log('');
        for (const line of d.footer.extras) console.log(line);
      }
      if (d.footer.reportBugs || d.footer.homepage) {
        console.log('');
        if (d.footer.reportBugs) console.log(`Report bugs to <${d.footer.reportBugs}>.`);
        if (d.footer.homepage) console.log(`Godmode home page: <${d.footer.homepage}>.`);
      }
    }
  }
}
