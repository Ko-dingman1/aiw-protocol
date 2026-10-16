import Fastify from 'fastify';
import type { ServerResponse } from 'node:http';
import {
  AiwError,
  KnowledgeObjectSchema,
  NodeDescriptorSchema,
  QuerySchema,
  QueryRequestSchema,
  VersionQuerySchema,
  matches,
  type KnowledgeObject,
  type NodeDescriptor,
} from '../../../packages/core/src/index.js';
import { installErrors } from '../../shared/http.js';
import { schemaCatalog } from '../../../packages/core/src/schemas.js';
import { KnowledgeStore } from './store.js';
import { queryPage } from './pagination.js';
export function createNode(
  initial: KnowledgeObject[],
  describe: () => NodeDescriptor,
  updateMs = 1000,
  options: {
    simulateWeather?: boolean;
    retentionLimit?: number;
    maxObjects?: number;
  } = {},
) {
  const app = Fastify({ bodyLimit: 65536 });
  installErrors(app);
  const store = new KnowledgeStore(initial, options);
  const streams = new Set<ServerResponse>();
  function publishKnowledge(input: KnowledgeObject): void {
    if (store.put(input)) app.server.emit('aiw-update', store.get(input.id));
  }
  function query(input: unknown) {
    const filter = QuerySchema.parse(input);
    if (filter.namespace && !describe().namespaces.includes(filter.namespace))
      throw new AiwError(
        'AIW_NAMESPACE_UNSUPPORTED',
        'Namespace is not hosted',
      );
    return filter;
  }
  app.get('/.well-known/aiw', async () =>
    NodeDescriptorSchema.parse(describe()),
  );
  app.post('/query', async (request) => {
    const { limit, cursor, ...filter } = QueryRequestSchema.parse(request.body);
    query(filter);
    return queryPage(store.latest(), { ...filter, limit, cursor });
  });
  app.get<{ Params: { id: string } }>('/objects/:id', async (request) => {
    const { version } = VersionQuerySchema.parse(request.query);
    return store.get(request.params.id, version);
  });
  app.get<{ Params: { id: string } }>('/objects/:id/history', async (request) =>
    store.history(request.params.id),
  );
  app.get<{ Params: { id: string } }>('/objects/:id/verify', async (request) =>
    store.verify(
      request.params.id,
      VersionQuerySchema.parse(request.query).version,
    ),
  );
  app.get('/schemas', async () => ({
    schemas: schemaCatalog().filter((schema) =>
      describe().schemas.includes(schema.id),
    ),
  }));
  app.get<{ Params: { id: string } }>('/schemas/:id', async (request) => {
    const schema = schemaCatalog().find(
      (schema) =>
        schema.id === request.params.id &&
        describe().schemas.includes(schema.id),
    );
    if (!schema)
      throw new AiwError(
        'AIW_SCHEMA_INVALID',
        'Schema is not supported by this node',
        404,
      );
    return schema;
  });
  app.get('/subscribe', async (request, reply) => {
    const filter = query(request.query);
    reply.hijack();
    const stream = reply.raw;
    streams.add(stream);
    stream.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    stream.write(': connected\n\n');
    const timer = setInterval(() => {
      if (!stream.write(': heartbeat\n\n')) stream.destroy();
    }, 15000);
    const send = (object: KnowledgeObject) => {
      if (
        matches(object, filter) &&
        !stream.write('event: object\ndata: ' + JSON.stringify(object) + '\n\n')
      )
        stream.destroy();
    };
    app.server.on('aiw-update', send);
    stream.on('close', () => {
      clearInterval(timer);
      streams.delete(stream);
      app.server.off('aiw-update', send);
    });
  });
  let tick = 0;
  const updates = setInterval(() => {
    if (options.simulateWeather === false) return;
    let current: KnowledgeObject;
    try {
      current = store.get('weather:seoul');
    } catch {
      return;
    }
    const now = new Date().toISOString();
    const next = KnowledgeObjectSchema.parse({
      ...current,
      value: (182 + (++tick % 5)) / 10,
      version: current.version + 1,
      observedAt: now,
      updatedAt: now,
      provenance: [
        {
          activity: 'Generated simulated weather update',
          agent: 'mock-weather-generator',
          at: now,
        },
      ],
    });
    publishKnowledge(next);
  }, updateMs);
  updates.unref();
  app.addHook('preClose', async () => {
    clearInterval(updates);
    for (const stream of streams) stream.end();
  });
  return Object.assign(app, { publishKnowledge });
}
