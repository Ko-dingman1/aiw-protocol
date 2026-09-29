import { KnowledgeObjectSchema } from '../../packages/core/src/index.js';
export function resolveCompany(name: string): string | undefined {
  return { 'Samsung Electronics': 'KRX:005930', 삼성전자: 'KRX:005930' }[name];
}
export function finance() {
  return KnowledgeObjectSchema.parse({
    id: 'finance:samsung:mock',
    type: 'record',
    schema: 'finance.price.v1',
    namespace: 'finance.krx',
    subject: resolveCompany('Samsung Electronics'),
    property: 'market.price',
    value: 70000,
    unit: 'KRW',
    originType: 'imported-data',
    provider: {
      id: 'fictional-market-provider',
      name: 'Fictional Market Provider',
    },
    source: {
      id: 'mock-market-file',
      description: 'FICTIONAL price; not market data or investment advice',
      mock: true,
    },
    createdAt: '2026-09-29T00:00:00.000Z',
    observedAt: '2026-09-29T00:00:00.000Z',
    version: 1,
    provenance: [
      {
        activity: 'Loaded fictional fixture',
        agent: 'finance-demo',
        at: '2026-09-29T00:00:00.000Z',
      },
    ],
  });
}
