import Fastify from 'fastify';
import {
  AiwError,
  DiscoverySchema,
  NodeDescriptorSchema,
  type NodeDescriptor,
} from '../../../packages/core/src/index.js';
import { installErrors } from '../../shared/http.js';
export function createRegistry(browserOrigin?: () => string) {
  const app = Fastify({ bodyLimit: 65536 });
  installErrors(app);
  app.addHook('onRequest', async (request, reply) => {
    if (
      request.method === 'GET' &&
      browserOrigin &&
      request.headers.origin === browserOrigin()
    ) {
      reply
        .header('access-control-allow-origin', browserOrigin())
        .header('vary', 'Origin');
    }
  });
  const nodes = new Map<string, NodeDescriptor>();
  app.get('/nodes', async () => ({ nodes: [...nodes.values()] }));
  app.post('/nodes', async (request, reply) => {
    const parsed = NodeDescriptorSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AiwError('AIW_SCHEMA_INVALID', 'Invalid node descriptor');
    nodes.set(parsed.data.nodeId, parsed.data);
    return reply.code(201).send(parsed.data);
  });
  app.get('/discover', async (request) => {
    const filter = DiscoverySchema.parse(request.query);
    const found = [...nodes.values()].filter(
      (node) =>
        (!filter.namespace || node.namespaces.includes(filter.namespace)) &&
        (!filter.schema || node.schemas.includes(filter.schema)) &&
        (!filter.capability || node.capabilities.includes(filter.capability)),
    );
    return { nodes: found };
  });
  return app;
}
