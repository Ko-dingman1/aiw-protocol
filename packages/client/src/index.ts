import { z } from 'zod';
import {
  AiwError,
  KnowledgeObjectSchema,
  QuerySchema,
  type KnowledgeObject,
  type NodeDescriptor,
  type Query,
} from '../../core/src/index.js';
import { request } from '../../resolver/src/http.js';
export class AiwClient {
  constructor(private node: NodeDescriptor) {}
  private url(
    path: string,
    capability: 'query' | 'fetch' | 'subscribe',
  ): string {
    if (!this.node.capabilities.includes(capability))
      throw new AiwError(
        'AIW_CAPABILITY_UNSUPPORTED',
        capability + ' is not advertised',
      );
    return new URL(path, this.node.endpoint).href;
  }
  async query(filter: Query = {}): Promise<KnowledgeObject[]> {
    const result = await request(
      this.url('/query', 'query'),
      z.object({ objects: z.array(KnowledgeObjectSchema) }),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(QuerySchema.parse(filter)),
      },
    );
    return result.objects;
  }
  fetch(id: string): Promise<KnowledgeObject> {
    return request(
      this.url('/objects/' + encodeURIComponent(id), 'fetch'),
      KnowledgeObjectSchema,
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
