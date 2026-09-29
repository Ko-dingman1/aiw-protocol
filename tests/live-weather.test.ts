import { describe, expect, it, vi } from 'vitest';
import {
  adaptOpenMeteo,
  OpenMeteoSource,
  SEOUL_WEATHER_URL,
} from '../packages/adapter-sdk/src/open-meteo.js';
import { startRuntime } from '../scripts/runtime.js';
import { RegistryResolver } from '../packages/resolver/src/index.js';
import { AiwClient } from '../packages/client/src/index.js';

const payload = {
  current_units: { temperature_2m: '°C', time: 'unixtime' },
  current: { time: 1790640000, temperature_2m: 21.4 },
};
const response = () =>
  new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
  });

describe('Open-Meteo adapter', () => {
  it('keeps model source distinct from primary measurements and mock observations', () => {
    const object = adaptOpenMeteo(payload, '2026-09-29T00:00:00.000Z', 1);
    expect(object).toMatchObject({
      type: 'record',
      originType: 'imported-data',
      value: 21.4,
      unit: 'C',
      source: { mock: false, id: 'open-meteo' },
    });
    expect(object.observedAt).toBe(
      new Date(payload.current.time * 1000).toISOString(),
    );
    expect(object.provider.id).not.toBe(object.source?.id);
  });
  it.each([
    {},
    { ...payload, current: { ...payload.current, temperature_2m: '21' } },
    { ...payload, current_units: { temperature_2m: '°F', time: 'unixtime' } },
    { ...payload, current: { ...payload.current, temperature_2m: Infinity } },
  ])('rejects invalid upstream payloads', (input) => {
    expect(() =>
      adaptOpenMeteo(input, '2026-09-29T00:00:00.000Z', 1),
    ).toThrow();
  });
  it('coalesces requests, caches results and increments versions after cooldown', async () => {
    let now = 1790640000000;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const source = new OpenMeteoSource(fetcher, () => now);
    const [first, second] = await Promise.all([
      source.refresh(),
      source.refresh(),
    ]);
    expect(first).toEqual(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(SEOUL_WEATHER_URL);
    first.value = 99;
    expect((await source.refresh()).value).toBe(21.4);
    now += 60001;
    const next = await source.refresh();
    expect(next.version).toBe(2);
    expect(next.createdAt).toBe(second.createdAt);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('records errors, avoids silent fallback and rate limits retries', async () => {
    let now = 1790640000000;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response())
      .mockRejectedValue(new Error('network details'));
    const source = new OpenMeteoSource(fetcher, () => now);
    await source.refresh();
    now += 60001;
    await expect(source.refresh()).rejects.toMatchObject({
      code: 'AIW_UPSTREAM_UNAVAILABLE',
    });
    expect(source.status()).toMatchObject({
      state: 'error',
      lastSuccessAt: '2026-09-29T00:00:00.000Z',
    });
    await expect(source.refresh()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(source.status().error).not.toContain('network details');
  });
  it('treats HTTP errors as unavailable', async () => {
    const source = new OpenMeteoSource(
      async () => new Response('rate limit', { status: 429 }),
    );
    await expect(source.refresh()).rejects.toMatchObject({ status: 503 });
  });
});

describe('live runtime and dashboard', () => {
  it('serves UI, discovers imported weather and rejects cross-origin refresh', async () => {
    const runtime = await startRuntime(0, 0, 20, {
      mode: 'live',
      source: new OpenMeteoSource(async () => response()),
    });
    try {
      const page = await fetch(runtime.nodeUrl);
      expect(await page.text()).toContain('지식 탐색');
      expect(page.headers.get('content-security-policy')).toContain(
        "script-src 'self'",
      );
      expect(
        (await fetch(runtime.nodeUrl + '/app.js')).headers.get('content-type'),
      ).toContain('javascript');
      const config = await (
        await fetch(runtime.nodeUrl + '/dashboard-config')
      ).json();
      expect(config.mode).toBe('live');
      const discovery = await fetch(runtime.registryUrl + '/discover', {
        headers: { origin: runtime.nodeUrl },
      });
      expect(discovery.headers.get('access-control-allow-origin')).toBe(
        runtime.nodeUrl,
      );
      const denied = await fetch(runtime.registryUrl + '/discover', {
        headers: { origin: 'https://example.com' },
      });
      expect(denied.headers.has('access-control-allow-origin')).toBe(false);
      const [node] = await new RegistryResolver(runtime.registryUrl).resolve({
        namespace: 'weather.kr',
      });
      const objects = await new AiwClient(node!).query({
        namespace: 'weather.kr',
      });
      expect(objects).toHaveLength(1);
      expect(objects[0]?.source?.mock).toBe(false);
      expect(
        (await fetch(runtime.nodeUrl + '/refresh', { method: 'POST' })).status,
      ).toBe(403);
      expect(
        (
          await fetch(runtime.nodeUrl + '/refresh', {
            method: 'POST',
            headers: {
              'x-aiw-request': 'dashboard',
              origin: 'https://example.com',
            },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(runtime.nodeUrl + '/refresh', {
            method: 'POST',
            headers: { 'x-aiw-request': 'dashboard' },
          })
        ).status,
      ).toBe(200);
    } finally {
      await runtime.close();
    }
  });
  it('starts dashboard when live API fails without returning fictional weather', async () => {
    const runtime = await startRuntime(0, 0, 20, {
      mode: 'live',
      source: new OpenMeteoSource(async () => {
        throw new Error('offline');
      }),
    });
    try {
      const [node] = await new RegistryResolver(runtime.registryUrl).resolve({
        namespace: 'weather.kr',
      });
      expect(
        await new AiwClient(node!).query({ namespace: 'weather.kr' }),
      ).toEqual([]);
      expect(
        (await (await fetch(runtime.nodeUrl + '/source-status')).json()).state,
      ).toBe('error');
      expect((await fetch(runtime.nodeUrl)).status).toBe(200);
    } finally {
      await runtime.close();
    }
  });
  it('keeps mock mode offline and rejects live refresh', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const runtime = await startRuntime(0, 0, 1000, {
      source: new OpenMeteoSource(fetcher),
    });
    try {
      expect(fetcher).not.toHaveBeenCalled();
      expect(
        (
          await fetch(runtime.nodeUrl + '/refresh', {
            method: 'POST',
            headers: { 'x-aiw-request': 'dashboard' },
          })
        ).status,
      ).toBe(400);
    } finally {
      await runtime.close();
    }
  });
});
