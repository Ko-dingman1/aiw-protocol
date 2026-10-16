import { z } from 'zod';
import { createHash } from 'node:crypto';
import {
  AiwError,
  QueryRequestSchema,
  matches,
  type KnowledgeObject,
  type QueryPage,
} from '../../../packages/core/src/index.js';

const CursorSchema = z
  .object({ after: z.string().min(1).max(512), filter: z.string().length(64) })
  .strict();
export function queryPage(
  objects: KnowledgeObject[],
  input: unknown,
): QueryPage {
  const { limit, cursor, ...filter } = QueryRequestSchema.parse(input);
  const signature = createHash('sha256')
    .update(
      JSON.stringify(
        Object.entries(filter)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    )
    .digest('hex');
  let after: string | undefined;
  if (cursor) {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('encoding');
      const parsed = CursorSchema.parse(
        JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
      );
      if (parsed.filter !== signature) throw new Error('filter');
      after = parsed.after;
    } catch {
      throw new AiwError(
        'AIW_QUERY_INVALID',
        'Invalid cursor or cursor/filter mismatch',
      );
    }
  }
  const sorted = objects
    .filter(
      (object) =>
        matches(object, filter) && (after === undefined || object.id > after),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const page = sorted.slice(0, limit);
  return {
    objects: page,
    ...(sorted.length > limit
      ? {
          nextCursor: Buffer.from(
            JSON.stringify({ after: page.at(-1)!.id, filter: signature }),
          ).toString('base64url'),
        }
      : {}),
  };
}
