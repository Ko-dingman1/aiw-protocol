import { z } from 'zod';
export const PROTOCOL_VERSION = '0.1' as const;
const text = z.string().min(1).max(512);
export const ProviderSchema = z.object({ id: text, name: text }).strict();
export const ObjectTypeSchema = z.enum([
  'observation',
  'claim',
  'inference',
  'record',
  'event',
  'document-reference',
]);
export const OriginTypeSchema = z.enum([
  'measurement',
  'official-record',
  'human-statement',
  'research',
  'imported-data',
  'ai-inference',
  'derived-data',
]);
export const ReferenceSchema = z
  .object({ id: text, version: z.number().int().positive() })
  .strict();
export const KnowledgeObjectSchema = z
  .object({
    id: text,
    type: ObjectTypeSchema,
    schema: text,
    namespace: text,
    subject: text,
    property: text,
    value: z.json(),
    provider: ProviderSchema,
    originType: OriginTypeSchema,
    createdAt: z.iso.datetime(),
    version: z.number().int().positive(),
    unit: text.optional(),
    source: z
      .object({
        id: text,
        description: text,
        url: z.url().optional(),
        mock: z.boolean().optional(),
      })
      .strict()
      .optional(),
    observedAt: z.iso.datetime().optional(),
    updatedAt: z.iso.datetime().optional(),
    evidence: z
      .array(
        z
          .object({
            description: text,
            object: ReferenceSchema.optional(),
            url: z.url().optional(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    provenance: z
      .array(
        z
          .object({
            activity: text,
            agent: text,
            at: z.iso.datetime(),
            input: ReferenceSchema.optional(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    derivedFrom: z.array(ReferenceSchema).max(100).optional(),
  })
  .strict()
  .superRefine((object, ctx) => {
    if (
      ['ai-inference', 'derived-data'].includes(object.originType) &&
      !object.derivedFrom?.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['derivedFrom'],
        message: 'Derived origins require input references',
      });
    if (
      object.derivedFrom?.some(
        (ref) => ref.id === object.id && ref.version === object.version,
      )
    )
      ctx.addIssue({
        code: 'custom',
        path: ['derivedFrom'],
        message: 'An object version cannot derive from itself',
      });
  });
export type KnowledgeObject = z.infer<typeof KnowledgeObjectSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export const CapabilitySchema = z.enum(['query', 'fetch', 'subscribe']);
export const NodeDescriptorSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    nodeId: text,
    endpoint: z
      .url()
      .refine(
        (v) => ['http:', 'https:'].includes(new URL(v).protocol),
        'HTTP endpoint required',
      ),
    provider: ProviderSchema,
    namespaces: z.array(text).min(1),
    schemas: z.array(text).min(1),
    capabilities: z.array(CapabilitySchema).min(1),
  })
  .strict();
export type NodeDescriptor = z.infer<typeof NodeDescriptorSchema>;
export const QuerySchema = z
  .object({
    namespace: text.optional(),
    subject: text.optional(),
    property: text.optional(),
    type: ObjectTypeSchema.optional(),
    provider: text.optional(),
  })
  .strict();
export type Query = z.infer<typeof QuerySchema>;
export const DiscoverySchema = z
  .object({
    namespace: text.optional(),
    schema: text.optional(),
    capability: CapabilitySchema.optional(),
  })
  .strict();
export type Discovery = z.infer<typeof DiscoverySchema>;
export const ErrorCodeSchema = z.enum([
  'AIW_NODE_NOT_FOUND',
  'AIW_OBJECT_NOT_FOUND',
  'AIW_SCHEMA_INVALID',
  'AIW_NAMESPACE_UNSUPPORTED',
  'AIW_CAPABILITY_UNSUPPORTED',
  'AIW_QUERY_INVALID',
  'AIW_ACCESS_DENIED',
  'AIW_INTERNAL_ERROR',
]);
export const ErrorResponseSchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string() }),
});
export class AiwError extends Error {
  constructor(
    public code: z.infer<typeof ErrorCodeSchema>,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export interface AuthorizationPolicy {
  authorize(
    action: string,
    resource: string,
    credential?: string,
  ): Promise<boolean>;
}
export function matches(object: KnowledgeObject, query: Query): boolean {
  return Object.entries(query).every(([key, value]) =>
    key === 'provider'
      ? object.provider.id === value
      : object[key as keyof Query] === value,
  );
}
export function verify(
  input: unknown,
  available: readonly KnowledgeObject[] = [],
): { valid: boolean; issues: string[] } {
  const parsed = KnowledgeObjectSchema.safeParse(input);
  if (!parsed.success)
    return {
      valid: false,
      issues: parsed.error.issues.map(
        (i) => i.path.join('.') + ': ' + i.message,
      ),
    };
  const object = parsed.data;
  const issues: string[] = [];
  if (!object.source) issues.push('Source metadata missing');
  if (!object.provenance?.length) issues.push('Provenance metadata missing');
  const references = [
    ...(object.derivedFrom ?? []),
    ...(object.evidence ?? []).flatMap((e) => (e.object ? [e.object] : [])),
    ...(object.provenance ?? []).flatMap((p) => (p.input ? [p.input] : [])),
  ];
  for (const ref of references)
    if (
      !available.some(
        (candidate) =>
          candidate.id === ref.id && candidate.version === ref.version,
      )
    )
      issues.push('Unresolved reference: ' + ref.id + '@' + ref.version);
  return { valid: issues.length === 0, issues };
}
