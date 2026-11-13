import type { ZodType } from 'zod';

// An error that carries the HTTP status the client should receive.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

// Validates untrusted input (body, query string, URL parameters) against a
// Zod schema. Returns fully typed data or throws a 400 with the first problem.
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new HttpError(400, issue?.message ?? 'Invalid input.');
}

// MySQL errors carry a symbolic code such as ER_DUP_ENTRY.
export function mysqlErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
