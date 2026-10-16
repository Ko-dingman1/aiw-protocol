import { z } from 'zod';
import {
  AiwError,
  KnowledgeObjectSchema,
  QuerySchema,
  QueryRequestSchema,
  QueryPageSchema,
  HistorySchema,
  VerificationSchema,
  type QueryRequest,
  type KnowledgeObject,
  type NodeDescriptor,
  type Query,
} from '../../core/src/index.js';
import { request } from '../../resolver/src/http.js';
import { SchemaDocumentSchema } from '../../core/src/schemas.js';
export class AiwClient {
  constructor(private node: NodeDescriptor) {}
  private url(
    path: string,
    capability: NodeDescriptor['capabilities'][number],
  ): string {
    if (!this.node.capabilities.includes(capability))
      throw new AiwError(
        'AIW_CAPABILITY_UNSUPPORTED',
        capability + ' is not advertised',
      );
    return new URL(path, this.node.endpoint).href;
  }
  async query(filter: Query = {}): Promise<KnowledgeObject[]> {
    const objects: KnowledgeObject[] = [];
    for await (const object of this.iterate(filter)) objects.push(object);
    return objects;
  }
  async *iterate(
    filter: Query = {},
    limit = 50,
  ): AsyncGenerator<KnowledgeObject> {
    const validated = QuerySchema.parse(filter);
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await this.queryPage({ ...validated, limit, cursor });
      for (const object of page.objects) yield object;
      cursor = page.nextCursor;
      if (cursor && (seen.has(cursor) || seen.size >= 10000))
        throw new AiwError(
          'AIW_QUERY_INVALID',
          'Remote pagination does not terminate',
        );
      if (cursor) seen.add(cursor);
    } while (cursor);
  }
  queryPage(input: QueryRequest = {}) {
    return request(this.url('/query', 'query'), QueryPageSchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(QueryRequestSchema.parse(input)),
    });
  }
  fetch(id: string, version?: number): Promise<KnowledgeObject> {
    if (version !== undefined) z.number().int().positive().parse(version);
    return request(
      this.url('/objects/' + encodeURIComponent(id), 'fetch') +
        (version === undefined ? '' : '?version=' + version),
      KnowledgeObjectSchema,
    );
  }
  history(id: string) {
    return request(
      this.url('/objects/' + encodeURIComponent(id) + '/history', 'history'),
      HistorySchema,
    );
  }
  verify(id: string, version?: number) {
    if (version !== undefined) z.number().int().positive().parse(version);
    return request(
      this.url('/objects/' + encodeURIComponent(id) + '/verify', 'verify') +
        (version === undefined ? '' : '?version=' + version),
      VerificationSchema,
    );
  }
  schemas() {
    return request(
      this.url('/schemas', 'schemas'),
      z.object({ schemas: z.array(SchemaDocumentSchema) }),
    );
  }
  async *subscribe(
    filter: Query = {},
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeObject> {
    const url = new URL(this.url('/subscribe', 'subscribe'));
    for (const [key, value] of Object.entries(QuerySchema.parse(filter)))
      if (value !== undefined) url.searchParams.set(key, value);
    const response = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(30000),
    });
    if (!response.ok || !response.body)
      throw new AiwError(
        'AIW_INTERNAL_ERROR',
        'Subscription failed',
        response.status,
      );
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, '\n');
        if (buffer.length > 1048576)
          throw new AiwError('AIW_SCHEMA_INVALID', 'SSE frame exceeds limit');
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          if (data) yield KnowledgeObjectSchema.parse(JSON.parse(data));
        }
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
}
