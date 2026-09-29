import { z } from 'zod';
import {
  AiwError,
  DiscoverySchema,
  NodeDescriptorSchema,
  type Discovery,
  type NodeDescriptor,
} from '../../core/src/index.js';
import { request } from './http.js';
export interface Resolver {
  resolve(requirement: Discovery): Promise<NodeDescriptor[]>;
}
export class RegistryResolver implements Resolver {
  constructor(private registryUrl: string) {}
  async resolve(requirement: Discovery): Promise<NodeDescriptor[]> {
    const filter = DiscoverySchema.parse(requirement);
    const url = new URL('/discover', this.registryUrl);
    for (const [key, value] of Object.entries(filter))
      if (value !== undefined) url.searchParams.set(key, value);
    const { nodes } = await request(
      url.href,
      z.object({ nodes: z.array(NodeDescriptorSchema) }),
    );
    if (!nodes.length)
      throw new AiwError('AIW_NODE_NOT_FOUND', 'No matching node', 404);
    return nodes;
  }
}
