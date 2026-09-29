import { describe, it, expect, afterEach } from 'vitest';
import { createRegistry } from '../apps/registry/src/index.js';
import { createNode } from '../apps/weather-node/src/index.js';
import { fixtures, descriptor } from '../examples/fixtures.js';
import { startRuntime } from '../scripts/runtime.js';
import { RegistryResolver } from '../packages/resolver/src/index.js';
import { AiwClient } from '../packages/client/src/index.js';
const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
describe('registry control plane', () => {
  it('registers descriptors, replaces same node ID and discovers intersecting filters', async () => {
    const app = createRegistry();
    cleanup.push(() => app.close());
    const node = descriptor('http://localhost:4001');
    expect(
      (await app.inject({ method: 'POST', url: '/nodes', payload: node }))
        .statusCode,
    ).toBe(201);
    await app.inject({ method: 'POST', url: '/nodes', payload: node });
    expect((await app.inject('/nodes')).json().nodes).toHaveLength(1);
    expect(
      (
        await app.inject(
          '/discover?namespace=weather.kr&capability=query&schema=weather.temperature.v1',
        )
      ).json().nodes,
    ).toHaveLength(1);
    expect(
      (await app.inject('/discover?namespace=absent')).json().nodes,
    ).toHaveLength(0);
    expect(
      (await app.inject({ method: 'POST', url: '/nodes', payload: {} })).json()
        .error.code,
    ).toBe('AIW_SCHEMA_INVALID');
  });
});
describe('knowledge plane', () => {
  it('filters every supported field and preserves conflicting providers', async () => {
    const app = createNode(fixtures(), () => descriptor('http://localhost'));
    cleanup.push(() => app.close());
    const query = async (payload: object) =>
      (await app.inject({ method: 'POST', url: '/query', payload })).json()
        .objects;
    expect(
      await query({
        namespace: 'organization.demo',
        subject: 'org:fictional-company',
        property: 'employeeCount',
        type: 'claim',
      }),
    ).toHaveLength(2);
    expect(await query({ provider: 'provider-0' })).toHaveLength(1);
    expect(await query({ subject: 'absent' })).toHaveLength(0);
    expect(await query({ type: 'observation' })).toHaveLength(1);
  });
  it('fetches opaque IDs and returns consistent errors', async () => {
    const app = createNode(fixtures(), () => descriptor('http://localhost'));
    cleanup.push(() => app.close());
    expect((await app.inject('/objects/weather%3Aseoul')).json().value).toBe(
      18.2,
    );
    expect((await app.inject('/objects/missing')).json().error.code).toBe(
      'AIW_OBJECT_NOT_FOUND',
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/query',
          payload: { namespace: 'absent' },
        })
      ).json().error.code,
    ).toBe('AIW_NAMESPACE_UNSUPPORTED');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/query',
          payload: { limit: 'unknown' },
        })
      ).json().error.code,
    ).toBe('AIW_QUERY_INVALID');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/query',
          headers: { 'content-type': 'application/json' },
          payload: '{',
        })
      ).json().error.code,
    ).toBe('AIW_QUERY_INVALID');
  });
});
describe('real HTTP agent flow', () => {
  it('discovers, queries, fetches and resolves derivation versions', async () => {
    const runtime = await startRuntime();
    cleanup.push(runtime.close);
    const resolver = new RegistryResolver(runtime.registryUrl);
    const [node] = await resolver.resolve({
      namespace: 'weather.kr',
      capability: 'query',
    });
    const client = new AiwClient(node!);
    const objects = await client.query({ namespace: 'weather.kr' });
    expect(objects[0]?.subject).toBe('geo:kr:seoul');
    expect(await client.fetch(objects[0]!.id)).toEqual(objects[0]);
    await expect(
      resolver.resolve({ namespace: 'missing' }),
    ).rejects.toMatchObject({ code: 'AIW_NODE_NOT_FOUND' });
    await expect(client.fetch('missing')).rejects.toMatchObject({
      code: 'AIW_OBJECT_NOT_FOUND',
    });
    const derived = (
      await client.query({ property: 'employeeCount.range' })
    )[0]!;
    for (const ref of derived.derivedFrom!)
      expect((await client.fetch(ref.id)).version).toBe(ref.version);
  });
  it('receives a validated SSE update and cancels cleanly', async () => {
    const runtime = await startRuntime(0, 0, 50);
    cleanup.push(runtime.close);
    const [node] = await new RegistryResolver(runtime.registryUrl).resolve({
      namespace: 'weather.kr',
      capability: 'subscribe',
    });
    const client = new AiwClient(node!);
    for await (const object of client.subscribe(
      { namespace: 'weather.kr' },
      AbortSignal.timeout(3000),
    )) {
      expect(object.version).toBeGreaterThan(1);
      expect(object.updatedAt).toBeDefined();
      expect(typeof object.value).toBe('number');
      break;
    }
  });
  it('rejects unadvertised capabilities', async () => {
    const client = new AiwClient({
      ...descriptor('http://localhost'),
      capabilities: ['fetch'],
    });
    await expect(client.query()).rejects.toMatchObject({
      code: 'AIW_CAPABILITY_UNSUPPORTED',
    });
  });
  it('does not deliver nonmatching SSE objects and allows cancellation', async () => {
    const runtime = await startRuntime(0, 0, 20);
    cleanup.push(runtime.close);
    const [node] = await new RegistryResolver(runtime.registryUrl).resolve({
      namespace: 'weather.kr',
    });
    const iterator = new AiwClient(node!).subscribe(
      { provider: 'absent' },
      AbortSignal.timeout(150),
    );
    await expect(iterator.next()).rejects.toThrow();
  });
});
