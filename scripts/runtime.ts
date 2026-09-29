import { createRegistry } from '../apps/registry/src/index.js';
import { createNode } from '../apps/weather-node/src/index.js';
import { fixtures, descriptor } from '../examples/fixtures.js';
import { NodeDescriptorSchema } from '../packages/core/src/index.js';
import { request } from '../packages/resolver/src/http.js';
export async function startRuntime(
  registryPort = 0,
  nodePort = 0,
  updateMs = 1000,
) {
  const registry = createRegistry();
  let endpoint = 'http://127.0.0.1';
  const node = createNode(fixtures(), () => descriptor(endpoint), updateMs);
  try {
    const registryUrl = await registry.listen({
      host: '127.0.0.1',
      port: registryPort,
    });
    endpoint = await node.listen({ host: '127.0.0.1', port: nodePort });
    const advertised = await request(
      new URL('/.well-known/aiw', endpoint).href,
      NodeDescriptorSchema,
    );
    await request(new URL('/nodes', registryUrl).href, NodeDescriptorSchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(advertised),
    });
    return {
      registryUrl,
      nodeUrl: endpoint,
      close: async () => {
        await node.close();
        await registry.close();
      },
    };
  } catch (error) {
    await node.close();
    await registry.close();
    throw error;
  }
}
