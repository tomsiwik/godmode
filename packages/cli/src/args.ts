export interface ParsedArgs {
  segments: string[];
  method: string;
  /** True when the user set method explicitly (positional or -g/-po/-d/etc.). */
  explicitMethod: boolean;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, string>;
  filter?: string;
  methodFilter?: string;
  all: boolean;
  /** Sourced from env vars GODMODE_VERBOSE / GODMODE_DRY_RUN; no user-facing flags. */
  verbose: boolean;
  dryRun: boolean;
  help: boolean;
}

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

export function parseArgs(args: string[]): ParsedArgs {
  const segments: string[] = [];
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  const body: Record<string, string> = {};
  let method = 'get';
  let explicitMethod = false;
  let filter: string | undefined;
  let methodFilter: string | undefined;
  let all = false;
  const verbose = process.env.GODMODE_VERBOSE === '1';
  const dryRun = process.env.GODMODE_DRY_RUN === '1';
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      // HTTP methods
      case '-g':  case '--get':    method = 'get';    explicitMethod = true; break;
      case '-po': case '--post':   method = 'post';   explicitMethod = true; break;
      case '-pu': case '--put':    method = 'put';    explicitMethod = true; break;
      case '-pa': case '--patch':  method = 'patch';  explicitMethod = true; break;
      case '-d':  case '--delete': method = 'delete'; explicitMethod = true; break;
      case '--head':               method = 'head';   explicitMethod = true; break;
      // Options
      case '-H': case '--header': {
        const val = args[++i];
        const idx = val.indexOf(':');
        if (idx > 0) headers[val.slice(0, idx).trim()] = val.slice(idx + 1).trim();
        break;
      }
      case '-F': case '--filter':  filter = args[++i];        break;
      case '-X': case '--method':  methodFilter = args[++i];  break;
      case '-A': case '--all':     all = true;                break;
      case '-h': case '--help':    help = true;       break;
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`Unknown flag: ${arg}\n`);
          process.exit(1);
        }
        // Positional HTTP method, only at the leading position (right after
        // the interface, e.g. `godmode stripe api GET account`).
        // Case-insensitive — `GET`, `get`, `Get` all work. Collision with a
        // lowercase resource named `get` is theoretical; real specs don't use
        // HTTP-verb names as paths.
        if (!segments.length && HTTP_METHODS.has(arg.toUpperCase())) {
          method = arg.toLowerCase();
          explicitMethod = true;
          break;
        }
        // httpie-style: key==value -> query, key=value -> body
        const eqeq = arg.indexOf('==');
        const eq = arg.indexOf('=');
        if (eqeq > 0) {
          query[arg.slice(0, eqeq)] = arg.slice(eqeq + 2);
        } else if (eq > 0) {
          body[arg.slice(0, eq)] = arg.slice(eq + 1);
        } else {
          segments.push(arg);
        }
    }
  }

  // body fields imply POST if no method was explicitly set
  if (Object.keys(body).length && !explicitMethod) method = 'post';

  return { segments, method, explicitMethod, headers, query, body, filter, methodFilter, all, verbose, dryRun, help };
}

export async function readStdin(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf-8').trim();
  return text || undefined;
}
