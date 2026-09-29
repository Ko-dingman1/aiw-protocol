import {
  KnowledgeObjectSchema,
  type KnowledgeObject,
} from '../../packages/core/src/index.js';
import type { Adapter } from '../../packages/adapter-sdk/src/index.js';
export interface WeatherReading {
  city: string;
  celsius: number;
  at: string;
}
export const weatherAdapter: Adapter<WeatherReading> = {
  id: 'mock-weather-adapter',
  convert(reading) {
    return [
      KnowledgeObjectSchema.parse({
        id: 'weather:seoul',
        type: 'observation',
        schema: 'weather.temperature.v1',
        namespace: 'weather.kr',
        subject: reading.city,
        property: 'weather.air-temperature',
        value: reading.celsius,
        unit: 'C',
        provider: {
          id: 'demo-weather-provider',
          name: 'Demo Weather Provider',
        },
        source: {
          id: 'mock-weather-source',
          description: 'Fictional local weather reading',
          mock: true,
        },
        originType: 'measurement',
        observedAt: reading.at,
        createdAt: reading.at,
        version: 1,
        provenance: [
          {
            activity: 'Mapped mock Celsius reading',
            agent: 'mock-weather-adapter',
            at: reading.at,
          },
        ],
      }),
    ];
  },
};
export function weather(): KnowledgeObject {
  return weatherAdapter.convert({
    city: 'geo:kr:seoul',
    celsius: 18.2,
    at: '2026-09-29T00:00:00.000Z',
  })[0]!;
}
