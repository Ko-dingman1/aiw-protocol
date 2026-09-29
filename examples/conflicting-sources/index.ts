import { KnowledgeObjectSchema } from '../../packages/core/src/index.js';
export function conflicts() {
  return [10231, 10417].map((value, index) =>
    KnowledgeObjectSchema.parse({
      id: 'employees:' + index,
      type: 'claim',
      schema: 'organization.employee-count.v1',
      namespace: 'organization.demo',
      subject: 'org:fictional-company',
      property: 'employeeCount',
      value,
      originType: 'human-statement',
      provider: {
        id: 'provider-' + index,
        name: 'Fictional Provider ' + index,
      },
      source: {
        id: 'mock-report-' + index,
        description:
          'Conflicting fictional report with independent methodology',
        mock: true,
      },
      createdAt: '2026-09-29T00:00:00.000Z',
      version: 1,
      evidence: [
        { description: 'Illustrative assertion only; no real evidence' },
      ],
      provenance: [
        {
          activity: 'Imported mock report without reconciliation',
          agent: 'conflict-demo',
          at: '2026-09-29T00:00:00.000Z',
        },
      ],
    }),
  );
}
