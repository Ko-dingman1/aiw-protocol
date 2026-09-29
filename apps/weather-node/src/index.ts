import Fastify from 'fastify';
import type { ServerResponse } from 'node:http';
import {
  AiwError,
  KnowledgeObjectSchema,
  NodeDescriptorSchema,
  QuerySchema,
  matches,
  type KnowledgeObject,
  type NodeDescriptor,
} from '../../../packages/core/src/index.js';
import { installErrors } from '../../shared/http.js';
export function createNode(
  initial: KnowledgeObject[],
  describe: () => NodeDescriptor,
  updateMs = 1000,
) {
  const app = Fastify({ bodyLimit: 65536 });
  installErrors(app);
  const objects = new Map(
    initial.map((object) => {
      const valid = KnowledgeObjectSchema.parse(object);
      return [valid.id, valid];
    }),
  );
  const streams = new Set<ServerResponse>();
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
    const filter = query(request.body);
    return {
      objects: [...objects.values()].filter((object) =>
        matches(object, filter),
      ),
    };
  });
  app.get<{ Params: { id: string } }>('/objects/:id', async (request) => {
    const object = objects.get(request.params.id);
    if (!object)
      throw new AiwError('AIW_OBJECT_NOT_FOUND', 'Object not found', 404);
    return object;
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
    const current = objects.get('weather:seoul');
    if (!current) return;
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
    objects.set(next.id, next);
    app.server.emit('aiw-update', next);
  }, updateMs);
  updates.unref();
  app.addHook('preClose', async () => {
    clearInterval(updates);
    for (const stream of streams) stream.end();
  });
  return app;
}
