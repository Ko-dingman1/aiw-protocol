import {
  KnowledgeObjectSchema,
  type KnowledgeObject,
} from '../../packages/core/src/index.js';
export function deriveRange(inputs: KnowledgeObject[]): KnowledgeObject {
  if (
    inputs.length !== 2 ||
    inputs.some((input) => typeof input.value !== 'number')
  )
    throw new Error('Two numeric input objects required');
  const values = inputs.map((input) => Number(input.value));
  return KnowledgeObjectSchema.parse({
    id: 'employees:range',
    type: 'inference',
    schema: 'organization.employee-range.v1',
    namespace: 'organization.demo',
    subject: 'org:fictional-company',
    property: 'employeeCount.range',
    value: { minimum: Math.min(...values), maximum: Math.max(...values) },
    originType: 'derived-data',
    provider: {
      id: 'demo-transformer',
      name: 'Deterministic Demo Transformer',
    },
    source: {
      id: 'range-function',
      description: 'Deterministic range over conflicting fictional claims',
      mock: true,
    },
    createdAt: '2026-09-29T00:00:00.000Z',
    version: 1,
    derivedFrom: inputs.map(({ id, version }) => ({ id, version })),
    provenance: [
      {
        activity:
          'Computed min/max; this is not a verified employee count or an LLM result',
        agent: 'range-function-v1',
        at: '2026-09-29T00:00:00.000Z',
      },
    ],
  });
}
