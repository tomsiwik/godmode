/**
 * Auth strategy. Each concrete subclass owns exactly one credential shape —
 * how the token is attached to a request, what it's called in help output,
 * and what error message fires when the env var is unset.
 *
 * Instantiate via `AuthStrategy.for(config)` — it handles the default
 * (bearer when `type` is omitted) and throws for unknown types so adding a
 * new one is a single-file change.
 */

export type AuthType = 'bearer' | 'api-key' | 'basic';

export interface AuthConfig {
  env?: string;
  type?: AuthType;
  /** Header name for api-key strategy (default `X-API-Key`). */
  header?: string;
}

export abstract class AuthStrategy {
  constructor(protected readonly config: AuthConfig = {}) {}

  /** Mutates `headers` to attach the credential. Called only when a token
   *  is present — callers are responsible for missing-token handling. */
  abstract apply(headers: Record<string, string>, token: string): void;

  /** Short label shown in help output (e.g. "bearer"). */
  abstract readonly label: AuthType;

  /** Human-readable message rendered when the env var is unset. */
  abstract missingMessage(): string;

  static for(config: AuthConfig | undefined | null): AuthStrategy {
    const type = config?.type ?? 'bearer';
    switch (type) {
      case 'bearer':  return new BearerAuth(config ?? {});
      case 'api-key': return new ApiKeyAuth(config ?? {});
      case 'basic':   return new BasicAuth(config ?? {});
    }
  }
}

class BearerAuth extends AuthStrategy {
  readonly label = 'bearer' as const;
  apply(headers: Record<string, string>, token: string) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  missingMessage() { return 'missing bearer token'; }
}

class ApiKeyAuth extends AuthStrategy {
  readonly label = 'api-key' as const;
  apply(headers: Record<string, string>, token: string) {
    headers[this.config.header || 'X-API-Key'] = token;
  }
  missingMessage() { return 'missing api-key'; }
}

class BasicAuth extends AuthStrategy {
  readonly label = 'basic' as const;
  apply(headers: Record<string, string>, token: string) {
    headers['Authorization'] = `Basic ${token}`;
  }
  missingMessage() { return 'missing basic auth credentials'; }
}
