import { describe, it, expect } from 'vitest';
import {
  HelpPage,
  RootHelp,
  ExtHelp,
  ExtensionOverview,
  ExtensionVersionPage,
  InterfaceHelp,
  type HelpPageData,
  type HelpSection,
} from '../src/help.js';
import type { Manifest, MultiManifest } from '../src/spec.js';

function capture(page: HelpPage): string[] {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
  };
  try { page.render(); } finally { console.log = orig; }
  return lines;
}

const stripeMulti: MultiManifest = {
  name: 'stripe',
  slug: 'stripe',
  description: 'Stripe test',
  auth: { env: 'STRIPE_API_KEY', type: 'bearer' },
  interfaces: {
    api: {
      type: 'api',
      specVersion: 'test-v1',
      url: 'https://api.stripe.com',
      versions: [],
      resourceDescriptions: {},
      routes: [],
    },
  },
};

const stripeManifest: Manifest = {
  name: 'stripe',
  description: 'Stripe test',
  specVersion: 'test-v1',
  config: {
    type: 'api',
    name: 'stripe',
    url: 'https://api.stripe.com',
    auth: { env: 'STRIPE_API_KEY', type: 'bearer' },
  },
  versions: [],
  resourceDescriptions: {},
  routes: [
    { path: '/customers', method: 'get', summary: 'list', version: '', segments: [{ value: 'customers', isParam: false }] },
    { path: '/customers', method: 'post', summary: 'create', version: '', segments: [{ value: 'customers', isParam: false }] },
  ],
};

// ── base contract ─────────────────────────────────────────

describe('HelpPage base contract', () => {
  it('default hooks return null / empty', () => {
    class Empty extends HelpPage {}
    const p = new Empty();
    expect(p.title()).toBeNull();
    expect(p.tagline()).toBeNull();
    expect(p.authNote()).toBeNull();
    expect(p.usage()).toEqual([]);
    expect(p.sections()).toEqual([]);
    expect(p.footer()).toBeNull();
  });

  it('toJSON() captures all hooks', () => {
    class Demo extends HelpPage {
      title() { return 'demo'; }
      usage() { return ['godmode demo']; }
      sections(): HelpSection[] { return [{ title: 'X:', rows: [['a', 'b']] }]; }
    }
    const json: HelpPageData = new Demo().toJSON();
    expect(json.title).toBe('demo');
    expect(json.usage).toEqual(['godmode demo']);
    expect(json.sections).toHaveLength(1);
  });

  it('subclasses can override sections() via super', () => {
    class Parent extends HelpPage {
      sections(): HelpSection[] { return [{ title: 'A:', rows: [['x', 'y']] }]; }
    }
    class Child extends Parent {
      sections() {
        return [...super.sections(), { title: 'B:', rows: [['c', 'd']] as string[][] }];
      }
    }
    expect(new Child().sections().map((s) => s.title)).toEqual(['A:', 'B:']);
  });
});

// ── RootHelp ──────────────────────────────────────────────

describe('RootHelp', () => {
  const out = capture(new RootHelp()).join('\n');

  it('renders tagline', () => {
    expect(out).toContain('A control surface of agentic I/O.');
  });
  it('renders both usage forms', () => {
    expect(out).toMatch(/Usage: godmode <extension>/);
    expect(out).toMatch(/^\s+or: godmode <extension> <interface>/m);
  });
  it('lists built-in extensions', () => {
    expect(out).toMatch(/Built-in extensions:/);
    expect(out).toContain('ext');
    expect(out).toContain('agent');
  });
  it('has Options with -v, --version', () => {
    expect(out).toMatch(/^Options:/m);
    expect(out).toContain('-v, --version');
  });
  it('has footer with bugs + homepage', () => {
    expect(out).toContain('Report bugs to <https://github.com/tomsiwik/godmode/issues>.');
    expect(out).toContain('Godmode home page: <https://godmode.so>.');
  });
});

// ── ExtHelp ───────────────────────────────────────────────

describe('ExtHelp', () => {
  const out = capture(new ExtHelp()).join('\n');
  it('tagline describes ext', () => expect(out).toContain('Install, inspect, and manage godmode extensions.'));
  it('shows command table', () => {
    for (const cmd of ['install', 'uninstall', 'update', 'list', 'create']) {
      expect(out).toContain(cmd);
    }
  });
  it('no Options block (nothing context-specific)', () => {
    // Commands section is the only one — no Options section
    expect(out).not.toMatch(/^Options:/m);
  });
});

// ── ExtensionOverview ─────────────────────────────────────

describe('ExtensionOverview', () => {
  const page = new ExtensionOverview(stripeMulti);
  const out = capture(page).join('\n');
  it('title is capitalized slug', () => expect(out).toMatch(/^Stripe$/m));
  it('Usage line(s) leading with interface', () => {
    expect(out).toContain('Usage: godmode stripe api');
  });
  it('Interfaces section lists url', () => {
    expect(out).toMatch(/Interfaces:/);
    expect(out).toContain('https://api.stripe.com');
  });
  it('Options has --version only', () => {
    expect(out).toContain('-v, --version');
    expect(out).not.toContain('-H, --header');
  });
});

// ── ExtensionVersionPage ──────────────────────────────────

describe('ExtensionVersionPage', () => {
  const page = new ExtensionVersionPage(stripeMulti);
  const out = capture(page).join('\n');
  it('shows name + per-interface spec version', () => {
    expect(out).toMatch(/^Stripe/m);
    expect(out).toContain('test-v1');
    expect(out).toContain('api');
  });
});

// ── InterfaceHelp ─────────────────────────────────────────

describe('InterfaceHelp', () => {
  const page = new InterfaceHelp(stripeManifest, 'stripe', [], { multi: stripeMulti });
  const out = capture(page).join('\n');

  it('title is "Stripe API"', () => expect(out).toMatch(/^Stripe API$/m));
  it('authNote fires when env missing', () => {
    delete process.env.STRIPE_API_KEY;
    const o = capture(new InterfaceHelp(stripeManifest, 'stripe')).join('\n');
    expect(o).toContain('--> STRIPE_API_KEY: missing bearer token');
  });
  it('authNote absent when env set', () => {
    process.env.STRIPE_API_KEY = 'sk_test_x';
    try {
      const o = capture(new InterfaceHelp(stripeManifest, 'stripe')).join('\n');
      expect(o).not.toContain('missing bearer token');
      expect(o).not.toContain('STRIPE_API_KEY');
    } finally {
      delete process.env.STRIPE_API_KEY;
    }
  });
  it('lists Methods in top-level view', () => {
    expect(out).toMatch(/Methods:/);
    expect(out).toContain('GET');
    expect(out).toContain('POST');
  });
  it('lists Resources', () => {
    expect(out).toMatch(/Resources:/);
    expect(out).toContain('customers');
  });
  it('Options block present with interface flags', () => {
    expect(out).toContain('-H, --header');
    expect(out).toContain('-A, --all');
    expect(out).toContain('-h, --help');
  });
});

// ── subclass injection demo ───────────────────────────────

describe('Extension can subclass InterfaceHelp to inject sections', () => {
  class StripeHelp extends InterfaceHelp {
    sections() {
      const base = super.sections();
      const custom: HelpSection = {
        title: 'curl equivalents:',
        rows: [['GET /v1/customers', 'curl https://api.stripe.com/v1/customers -u sk:']],
      };
      // inject just before Options (last section)
      return [...base.slice(0, -1), custom, base[base.length - 1]];
    }
  }
  it('adds the curl section', () => {
    const out = capture(new StripeHelp(stripeManifest, 'stripe', [], { multi: stripeMulti })).join('\n');
    expect(out).toContain('curl equivalents:');
    expect(out).toContain('curl https://api.stripe.com');
  });
  it('curl section appears before Options', () => {
    const lines = capture(new StripeHelp(stripeManifest, 'stripe', [], { multi: stripeMulti }));
    const curlIdx = lines.findIndex((l) => l.includes('curl equivalents:'));
    const optsIdx = lines.findIndex((l) => /^Options:/.test(l));
    expect(curlIdx).toBeGreaterThan(0);
    expect(curlIdx).toBeLessThan(optsIdx);
  });
});
