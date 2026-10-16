import { describe, it, expect } from 'vitest';
import { fixtures, descriptor } from '../examples/fixtures.js';
import { validateDomain, schemaCatalog } from '../packages/core/src/schemas.js';
import { KnowledgeStore } from '../apps/weather-node/src/store.js';
import { queryPage } from '../apps/weather-node/src/pagination.js';
import { createNode } from '../apps/weather-node/src/index.js';
import { AiwClient } from '../packages/client/src/index.js';

const base = () => fixtures()[0]!;
describe('domain validation', () => {
  it('validates every fixture and exports machine-readable schema documents', () => {
    for (const object of fixtures())
      expect(validateDomain(object)).toEqual(object);
    const catalog = schemaCatalog();
    expect(catalog).toHaveLength(4);
    expect(catalog[0]?.jsonSchema.properties).toHaveProperty('value');
  });
  it.each([
    { value: 'hot' },
    { unit: 'F' },
    { value: 101 },
    { namespace: 'finance.krx' },
    { property: 'unrelated' },
    { schema: 'unknown' },
  ])('rejects incompatible weather input %j', (change) => {
    expect(() => validateDomain({ ...base(), ...change })).toThrow();
  });
  it('rejects negative/fractional counts, negative prices and reversed ranges', () => {
    const all = fixtures();
    for (const value of [-1, 1.5])
      expect(() => validateDomain({ ...all[2], value })).toThrow();
    expect(() => validateDomain({ ...all[1], value: -1 })).toThrow();
    expect(() =>
      validateDomain({ ...all[4], value: { minimum: 20, maximum: 10 } }),
    ).toThrow();
  });
});
describe('immutable bounded history', () => {
  it('keeps prior values and isolates caller mutations', () => {
    const input = base();
    const store = new KnowledgeStore([input]);
    input.value = 99;
    store.put({ ...base(), version: 2, value: 22 });
    expect(store.get(input.id, 1).value).toBe(18.2);
    expect(store.get(input.id).value).toBe(22);
    const output = store.get(input.id, 1);
    output.value = 50;
    expect(store.get(input.id, 1).value).toBe(18.2);
    expect(store.history(input.id).versions).toEqual([2, 1]);
  });
  it('allows exact retries but rejects rewrites, backdated versions and identity changes', () => {
    const store = new KnowledgeStore([base()]);
    expect(store.put(base())).toBe(false);
    expect(() => store.put({ ...base(), value: 19 })).toThrow(/immutable/);
    store.put({ ...base(), version: 3 });
    expect(() => store.put({ ...base(), version: 2 })).toThrow();
    expect(() =>
      store.put({ ...base(), version: 4, subject: 'another-city' }),
    ).toThrow(/identity/);
  });
  it('prunes oldest versions and returns explicit unavailable-version errors', () => {
    const store = new KnowledgeStore([base()], { retentionLimit: 2 });
    store.put({ ...base(), version: 2 });
    store.put({ ...base(), version: 3 });
    expect(store.history(base().id)).toMatchObject({
      versions: [3, 2],
      oldestAvailableVersion: 2,
      retained: 2,
    });
    expect(() => store.get(base().id, 1)).toThrow(/not retained/);
    expect(store.get(base().id, 2).version).toBe(2);
  });
  it('verifies historical derivation references after newer inputs arrive', () => {
    const all = fixtures();
    const store = new KnowledgeStore(all, { retentionLimit: 2 });
    store.put({ ...all[2]!, version: 2, value: 11000 });
    expect(store.verify('employees:range').valid).toBe(true);
    store.put({ ...all[2]!, version: 3, value: 12000 });
    expect(store.verify('employees:range').valid).toBe(false);
  });
  it('enforces object and serialized memory limits without partial writes', () => {
    const store = new KnowledgeStore([base()], { maxObjects: 1 });
    expect(() => store.put({ ...base(), id: 'second' })).toThrow(/capacity/);
    const bytes = Buffer.byteLength(JSON.stringify(base()));
    const small = new KnowledgeStore([base()], { maxBytes: bytes + 5 });
    expect(() => small.put({ ...base(), version: 2 })).toThrow(/capacity/);
    expect(small.history(base().id).versions).toEqual([1]);
    const retained = new KnowledgeStore([base()], {
      maxBytes: bytes + 5,
      retentionLimit: 1,
    });
    expect(retained.put({ ...base(), version: 2 })).toBe(true);
  });
});
describe('cursor pagination', () => {
  it('keeps cursors bounded for long Unicode identifiers and filters', () => {
    const subject = '한'.repeat(512);
    const provider = { ...base().provider, id: '국'.repeat(512) };
    const objects = ['가', '나'].map((prefix) => ({
      ...base(),
      id: prefix.repeat(512),
      subject,
      provider,
    }));
    const filter = { subject, provider: provider.id, limit: 1 };
    const first = queryPage(objects, filter);
    expect(first.nextCursor!.length).toBeLessThanOrEqual(8192);
    const second = queryPage(objects, { ...filter, cursor: first.nextCursor });
    expect(second.objects[0]?.id).toBe(objects[1]!.id);
    expect(second.nextCursor).toBeUndefined();
  });
  it('returns ordered bounded pages without collapsing conflicting providers', () => {
    const first = queryPage(fixtures(), {
      namespace: 'organization.demo',
      limit: 1,
    });
    const second = queryPage(fixtures(), {
      namespace: 'organization.demo',
      limit: 1,
      cursor: first.nextCursor,
    });
    expect(first.objects[0]?.id).toBe('employees:0');
    expect(second.objects[0]?.id).toBe('employees:1');
    expect(first.objects[0]?.value).not.toBe(second.objects[0]?.value);
  });
  it('rejects altered filters, malformed cursors and excessive page limits', () => {
    const page = queryPage(fixtures(), { limit: 1 });
    expect(() =>
      queryPage(fixtures(), {
        namespace: 'weather.kr',
        cursor: page.nextCursor,
      }),
    ).toThrow(/mismatch/);
    expect(() => queryPage(fixtures(), { cursor: '!!!!' })).toThrow();
    expect(() => queryPage(fixtures(), { limit: 101 })).toThrow();
    expect(() => queryPage(fixtures(), { limit: 0 })).toThrow();
  });
  it('uses keyset order when another object is inserted before the next page', () => {
    const first = queryPage(fixtures(), { limit: 1 });
    const rest = queryPage([{ ...base(), id: 'aaa' }, ...fixtures()], {
      cursor: first.nextCursor,
    });
    expect(
      rest.objects.some((object) => object.id === first.objects[0]?.id),
    ).toBe(false);
    expect(rest.objects).toHaveLength(fixtures().length - 1);
  });
});
describe('v0.3 real HTTP client', () => {
  it('iterates more than one page and fetches exact history, schemas and verification', async () => {
    let endpoint = 'http://127.0.0.1';
    const initial = [
      ...fixtures(),
      ...Array.from({ length: 105 }, (_, i) => ({
        ...base(),
        id: 'extra:' + String(i).padStart(3, '0'),
      })),
    ];
    const app = createNode(initial, () => descriptor(endpoint), 1000, {
      simulateWeather: false,
    });
    endpoint = await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const client = new AiwClient(descriptor(endpoint));
      const page = await client.queryPage({ limit: 3 });
      expect(page.objects).toHaveLength(3);
      expect(page.nextCursor).toBeDefined();
      expect(await client.query()).toHaveLength(110);
      expect(await client.query({ schema: 'finance.price.v1' })).toHaveLength(
        1,
      );
      app.publishKnowledge({ ...base(), version: 2, value: 25 });
      expect((await client.fetch(base().id, 1)).value).toBe(18.2);
      expect((await client.fetch(base().id)).value).toBe(25);
      expect((await client.history(base().id)).versions).toEqual([2, 1]);
      expect((await client.schemas()).schemas).toHaveLength(4);
      expect((await client.verify('employees:range')).valid).toBe(true);
      await expect(client.fetch(base().id, 99)).rejects.toMatchObject({
        code: 'AIW_VERSION_UNAVAILABLE',
        status: 410,
      });
      expect(
        (await app.inject('/objects/weather%3Aseoul?version=1.5')).statusCode,
      ).toBe(400);
      expect((await app.inject('/objects/missing/history')).statusCode).toBe(
        404,
      );
    } finally {
      await app.close();
    }
  });
});
