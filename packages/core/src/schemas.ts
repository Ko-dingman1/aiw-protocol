import { z } from 'zod';
import {
  AiwError,
  KnowledgeObjectSchema,
  type KnowledgeObject,
} from './index.js';

const definitions = [
  {
    id: 'weather.temperature.v1',
    title: 'Air temperature in Celsius',
    rules: z.object({
      namespace: z.literal('weather.kr'),
      property: z.literal('weather.air-temperature'),
      unit: z.literal('C'),
      value: z.number().min(-100).max(100),
    }),
    constraints: [
      'Prototype air temperature range: -100 to 100 °C; does not establish physical truth.',
    ],
  },
  {
    id: 'finance.price.v1',
    title: 'Nonnegative market price in KRW',
    rules: z.object({
      namespace: z.literal('finance.krx'),
      property: z.literal('market.price'),
      unit: z.literal('KRW'),
      value: z.number().nonnegative(),
    }),
    constraints: ['Prototype KRW price; no market accuracy verification.'],
  },
  {
    id: 'organization.employee-count.v1',
    title: 'Nonnegative employee count',
    rules: z.object({
      namespace: z.literal('organization.demo'),
      property: z.literal('employeeCount'),
      value: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    }),
    constraints: ['Count must be a nonnegative safe integer.'],
  },
  {
    id: 'organization.employee-range.v1',
    title: 'Employee count range',
    rules: z.object({
      namespace: z.literal('organization.demo'),
      property: z.literal('employeeCount.range'),
      value: z
        .object({
          minimum: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
          maximum: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        })
        .strict(),
    }),
    constraints: [
      'minimum must be <= maximum; this cross-field rule is checked by the node in addition to JSON Schema.',
    ],
  },
];

export const SchemaDocumentSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    jsonSchema: z.record(z.string(), z.json()),
    constraints: z.array(z.string()),
  })
  .strict();
export type SchemaDocument = z.infer<typeof SchemaDocumentSchema>;

/** Catalog schemas describe domain-specific fields, in addition to the core envelope. */
export function schemaCatalog(): SchemaDocument[] {
  return definitions.map(({ id, title, rules, constraints }) =>
    SchemaDocumentSchema.parse({
      id,
      title,
      constraints,
      jsonSchema: z.toJSONSchema(rules, { io: 'input' }),
    }),
  );
}

export function validateDomain(input: unknown): KnowledgeObject {
  const envelope = KnowledgeObjectSchema.safeParse(input);
  if (!envelope.success)
    throw new AiwError(
      'AIW_SCHEMA_INVALID',
      'Invalid Knowledge Object envelope',
    );
  const object = envelope.data;
  const definition = definitions.find((entry) => entry.id === object.schema);
  if (!definition)
    throw new AiwError(
      'AIW_SCHEMA_INVALID',
      'Unknown domain schema: ' + object.schema,
    );
  const result = definition.rules.safeParse(object);
  if (!result.success)
    throw new AiwError(
      'AIW_SCHEMA_INVALID',
      'Domain validation failed: ' +
        result.error.issues
          .map((issue) => issue.path.join('.') + ': ' + issue.message)
          .join('; '),
    );
  if (object.schema === 'organization.employee-range.v1') {
    const range = z
      .object({ minimum: z.number(), maximum: z.number() })
      .parse(object.value);
    if (range.minimum > range.maximum)
      throw new AiwError('AIW_SCHEMA_INVALID', 'minimum must be <= maximum');
  }
  return object;
}
