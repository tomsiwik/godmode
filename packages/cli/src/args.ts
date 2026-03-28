export interface ParsedArgs {
  segments: string[];
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, string>;
  token?: string;
  filter?: string;
  methodFilter?: string;
  all: boolean;
  verbose: boolean;
  dryRun: boolean;
  help: boolean;
}

export function parseArgs(args: string[]): ParsedArgs {
  const segments: string[] = [];
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  const body: Record<string, string> = {};
  let method = 'get';
  let token: string | undefined;
  let filter: string | undefined;
  let methodFilter: string | undefined;
  let all = false;
  let verbose = false;
  let dryRun = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      // HTTP methods
      case '-g':  case '--get':    method = 'get';    break;
      case '-po': case '--post':   method = 'post';   break;
      case '-pu': case '--put':    method = 'put';    break;
      case '-pa': case '--patch':  method = 'patch';  break;
      case '-d':  case '--delete': method = 'delete'; break;
      case '--head':               method = 'head';   break;
      // Options
      case '-H': case '--header': {
        const val = args[++i];
        const idx = val.indexOf(':');
        if (idx > 0) headers[val.slice(0, idx).trim()] = val.slice(idx + 1).trim();
        break;
      }
      case '--token':              token = args[++i];  break;
      case '--filter':             filter = args[++i];       break;
      case '--method':             methodFilter = args[++i]; break;
      case '--all':                all = true;               break;
      case '-v': case '--verbose': verbose = true;    break;
      case '--dry-run':            dryRun = true;     break;
      case '-h': case '--help':    help = true;       break;
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`Unknown flag: ${arg}\n`);
          process.exit(1);
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
  if (Object.keys(body).length && method === 'get') method = 'post';

  return { segments, method, headers, query, body, token, filter, methodFilter, all, verbose, dryRun, help };
}

export async function readStdin(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf-8').trim();
  return text || undefined;
}
