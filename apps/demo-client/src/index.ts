import { RegistryResolver } from '../../../packages/resolver/src/index.js';
import { AiwClient } from '../../../packages/client/src/index.js';
import { verify, type Query } from '../../../packages/core/src/index.js';
import { resolveCompany } from '../../../examples/finance/index.js';
export async function runDemo(registryUrl: string, mode = 'weather') {
  const namespace =
    mode === 'finance'
      ? 'finance.krx'
      : ['conflicts', 'derived'].includes(mode)
        ? 'organization.demo'
        : 'weather.kr';
  const resolver = new RegistryResolver(registryUrl);
  const nodes = await resolver.resolve({
    namespace,
    capability: mode === 'subscribe' ? 'subscribe' : 'query',
  });
  console.log(
    'Agent → Resolver → Registry → discovered Node:',
    nodes.map((n) => n.nodeId).join(', '),
  );
  const filter: Query =
    mode === 'finance'
      ? { namespace, subject: resolveCompany('Samsung Electronics') }
      : mode === 'conflicts'
        ? { namespace, property: 'employeeCount' }
        : { namespace };
  if (mode === 'subscribe') {
    const client = new AiwClient(nodes[0]!);
    for await (const update of client.subscribe(
      filter,
      AbortSignal.timeout(5000),
    )) {
      console.log('SSE update:', JSON.stringify(update, null, 2));
      break;
    }
    return;
  }
  const objects = (
    await Promise.all(nodes.map((node) => new AiwClient(node).query(filter)))
  ).flat();
  console.log('FICTIONAL MOCK DATA — directly retrieved from discovered node');
  console.log(
    JSON.stringify(
      mode === 'derived'
        ? objects.filter((o) => o.originType === 'derived-data')
        : objects,
      null,
      2,
    ),
  );
  if (mode === 'derived')
    for (const object of objects.filter((o) => o.derivedFrom))
      console.log('Structural VERIFY:', verify(object, objects));
  if (mode === 'weather') {
    const first = objects[0]!;
    console.log('FETCH:', (await new AiwClient(nodes[0]!).fetch(first.id)).id);
  }
}
