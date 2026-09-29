import { z } from 'zod';
import {
  AiwError,
  KnowledgeObjectSchema,
  type KnowledgeObject,
} from '../../core/src/index.js';

export const SEOUL_WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m&temperature_unit=celsius&timeformat=unixtime&timezone=UTC';
const ResponseSchema = z.object({
  current_units: z.object({
    temperature_2m: z.literal('°C'),
    time: z.literal('unixtime'),
  }),
  current: z.object({
    time: z.number().int().nonnegative().max(253402300799),
    temperature_2m: z.number().min(-100).max(100),
  }),
});

export function adaptOpenMeteo(
  input: unknown,
  at: string,
  version: number,
  createdAt = at,
): KnowledgeObject {
  const parsed = ResponseSchema.safeParse(input);
  if (!parsed.success)
    throw new AiwError(
      'AIW_SCHEMA_INVALID',
      'Open-Meteo returned unexpected weather data',
      502,
    );
  return KnowledgeObjectSchema.parse({
    id: 'weather:seoul:open-meteo',
    type: 'record',
    schema: 'weather.temperature.v1',
    namespace: 'weather.kr',
    subject: 'geo:kr:seoul',
    property: 'weather.air-temperature',
    value: parsed.data.current.temperature_2m,
    unit: 'C',
    provider: { id: 'aiw-open-meteo-adapter', name: 'AIW Open-Meteo Adapter' },
    source: {
      id: 'open-meteo',
      description:
        'Open-Meteo current weather model data; model valid time, not a local sensor measurement. CC BY 4.0.',
      url: 'https://open-meteo.com/',
      mock: false,
    },
    originType: 'imported-data',
    observedAt: new Date(parsed.data.current.time * 1000).toISOString(),
    createdAt,
    updatedAt: at,
    version,
    provenance: [
      {
        activity:
          'Retrieved Seoul model temperature from Open-Meteo and mapped Celsius without inference',
        agent: 'aiw-open-meteo-adapter-v1',
        at,
      },
    ],
  });
}

export interface WeatherStatus {
  state: 'idle' | 'ready' | 'error';
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  nextRefreshAt?: string;
  error?: string;
}

/** Bounded, single-flight upstream access. A failed refresh preserves the last good object. */
export class OpenMeteoSource {
  private object?: KnowledgeObject;
  private inFlight?: Promise<KnowledgeObject>;
  private nextAttempt = 0;
  private state: WeatherStatus = { state: 'idle' };
  constructor(
    private fetcher: typeof fetch = fetch,
    private now: () => number = Date.now,
    private cacheMs = 60_000,
  ) {}
  status(): WeatherStatus {
    return { ...this.state };
  }
  refresh(): Promise<KnowledgeObject> {
    if (this.inFlight) return this.inFlight;
    if (this.now() < this.nextAttempt) {
      if (this.state.state === 'error')
        return Promise.reject(
          new AiwError(
            'AIW_UPSTREAM_UNAVAILABLE',
            this.state.error ?? 'Weather source unavailable',
            503,
          ),
        );
      if (this.object) return Promise.resolve(structuredClone(this.object));
    }
    this.inFlight = this.load().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }
  private async load(): Promise<KnowledgeObject> {
    const at = new Date(this.now()).toISOString();
    this.nextAttempt = this.now() + this.cacheMs;
    this.state = {
      ...this.state,
      lastAttemptAt: at,
      nextRefreshAt: new Date(this.nextAttempt).toISOString(),
    };
    try {
      const response = await this.fetcher(SEOUL_WEATHER_URL, {
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Upstream HTTP failure');
      const object = adaptOpenMeteo(
        await response.json(),
        at,
        (this.object?.version ?? 0) + 1,
        this.object?.createdAt,
      );
      this.object = object;
      this.state = {
        state: 'ready',
        lastAttemptAt: at,
        lastSuccessAt: at,
        nextRefreshAt: new Date(this.nextAttempt).toISOString(),
      };
      return structuredClone(object);
    } catch (error) {
      const message =
        error instanceof AiwError
          ? error.message
          : 'Open-Meteo is unavailable; retry after the refresh cooldown';
      this.state = { ...this.state, state: 'error', error: message };
      throw new AiwError('AIW_UPSTREAM_UNAVAILABLE', message, 503);
    }
  }
}
