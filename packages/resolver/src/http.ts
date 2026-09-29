import { z } from 'zod';
import { AiwError, ErrorResponseSchema } from '../../core/src/index.js';
export async function request<T>(
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(5000),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = ErrorResponseSchema.safeParse(body);
    throw error.success
      ? new AiwError(
          error.data.error.code,
          error.data.error.message,
          response.status,
        )
      : new AiwError(
          'AIW_INTERNAL_ERROR',
          'Invalid remote error',
          response.status,
        );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new AiwError('AIW_SCHEMA_INVALID', 'Invalid remote response', 502);
  return parsed.data;
}
