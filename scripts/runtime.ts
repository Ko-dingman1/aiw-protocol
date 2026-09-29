import { createRegistry } from '../apps/registry/src/index.js';
import { createNode } from '../apps/weather-node/src/index.js';
import { fixtures, descriptor } from '../examples/fixtures.js';
import { NodeDescriptorSchema } from '../packages/core/src/index.js';
import { request } from '../packages/resolver/src/http.js';
import { OpenMeteoSource } from '../packages/adapter-sdk/src/open-meteo.js';
import { registerDashboard } from '../apps/dashboard/src/index.js';
export async function startRuntime(
  registryPort = 0,
  nodePort = 0,
  updateMs = 1000,
  options: { mode?: 'mock' | 'live'; source?: OpenMeteoSource } = {},
) {
  let endpoint = 'http://127.0.0.1';
  let registryUrl = 'http://127.0.0.1';
  const mode = options.mode ?? 'mock';
  const source = options.source ?? new OpenMeteoSource();
  const registry = createRegistry(() => new URL(endpoint).origin);
  const initial =
    mode === 'live'
      ? fixtures().filter((object) => object.namespace !== 'weather.kr')
      : fixtures();
  const node = createNode(initial, () => descriptor(endpoint), updateMs, {
    simulateWeather: mode === 'mock',
  });
  const refresh = async () => {
    const object = await source.refresh();
    node.publishKnowledge(object);
    return object;
  };
  registerDashboard(node, {
    registryUrl: () => registryUrl,
    nodeUrl: () => endpoint,
    mode,
    status: () => (mode === 'live' ? source.status() : { state: 'ready' }),
    refresh: mode === 'live' ? refresh : undefined,
  });
  try {
    registryUrl = await registry.listen({
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
    if (mode === 'live') {
      try {
        await refresh();
      } catch {
        /* Dashboard exposes source failure; mock data never substitutes for live weather. */
      }
    }
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
