import {
  NodeDescriptorSchema,
  PROTOCOL_VERSION,
} from '../packages/core/src/index.js';
import { weather } from './weather/index.js';
import { finance } from './finance/index.js';
import { conflicts } from './conflicting-sources/index.js';
import { deriveRange } from './derived/index.js';
export function fixtures() {
  const claims = conflicts();
  return [weather(), finance(), ...claims, deriveRange(claims)];
}
export function descriptor(endpoint: string) {
  const objects = fixtures();
  return NodeDescriptorSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    nodeId: 'demo-knowledge-node',
    endpoint,
    provider: { id: 'demo-node-operator', name: 'Demo Node Operator' },
    namespaces: [...new Set(objects.map((o) => o.namespace))],
    schemas: [...new Set(objects.map((o) => o.schema))],
    capabilities: ['query', 'fetch', 'subscribe'],
  });
}
