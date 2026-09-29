import { describe, it, expect } from 'vitest';
import {
  KnowledgeObjectSchema,
  NodeDescriptorSchema,
  verify,
} from '../packages/core/src/index.js';
import { fixtures, descriptor } from '../examples/fixtures.js';
describe('contracts', () => {
  it('validates all fixture kinds and descriptor', () => {
    for (const item of fixtures())
      expect(KnowledgeObjectSchema.safeParse(item).success).toBe(true);
    expect(
      NodeDescriptorSchema.safeParse(descriptor('http://localhost:4001'))
        .success,
    ).toBe(true);
  });
  it('rejects missing value, invalid origin, and non HTTP endpoint', () => {
    const item = { ...fixtures()[0], value: undefined };
    expect(KnowledgeObjectSchema.safeParse(item).success).toBe(false);
    expect(
      KnowledgeObjectSchema.safeParse({ ...fixtures()[0], originType: 'truth' })
        .success,
    ).toBe(false);
    expect(
      NodeDescriptorSchema.safeParse({
        ...descriptor('http://localhost'),
        endpoint: 'ftp://example.com',
      }).success,
    ).toBe(false);
  });
  it('requires derivation inputs and resolves exact versions', () => {
    const all = fixtures();
    const derived = all.at(-1)!;
    expect(verify(derived, all).valid).toBe(true);
    expect(verify(derived, []).valid).toBe(false);
    expect(
      KnowledgeObjectSchema.safeParse({ ...derived, derivedFrom: [] }).success,
    ).toBe(false);
    expect(verify({ ...derived, source: undefined }, all).valid).toBe(false);
    expect(
      verify(
        { ...derived, derivedFrom: [{ id: 'employees:0', version: 99 }] },
        all,
      ).valid,
    ).toBe(false);
    expect(
      KnowledgeObjectSchema.safeParse({
        ...derived,
        derivedFrom: [{ id: derived.id, version: derived.version }],
      }).success,
    ).toBe(false);
  });
  it('separates optional metadata from the stricter verification audit', () => {
    const minimal = { ...fixtures()[0]! };
    delete minimal.source;
    delete minimal.provenance;
    expect(KnowledgeObjectSchema.safeParse(minimal).success).toBe(true);
    expect(verify(minimal).issues).toEqual([
      'Source metadata missing',
      'Provenance metadata missing',
    ]);
  });
  it('accepts all six types and marks AI derivation explicitly', () => {
    for (const type of [
      'observation',
      'claim',
      'inference',
      'record',
      'event',
      'document-reference',
    ]) {
      expect(
        KnowledgeObjectSchema.safeParse({ ...fixtures()[0], type }).success,
      ).toBe(true);
    }
    const derived = { ...fixtures().at(-1)!, originType: 'ai-inference' };
    expect(KnowledgeObjectSchema.safeParse(derived).success).toBe(true);
    expect(
      KnowledgeObjectSchema.safeParse({ ...derived, derivedFrom: undefined })
        .success,
    ).toBe(false);
  });
  it('checks evidence and provenance references independently', () => {
    const object = fixtures()[0]!;
    const ref = { id: 'missing', version: 1 };
    expect(
      verify({
        ...object,
        evidence: [{ description: 'Supporting record', object: ref }],
      }).valid,
    ).toBe(false);
    expect(
      verify({
        ...object,
        provenance: [
          {
            activity: 'Imported',
            agent: 'demo',
            at: object.createdAt,
            input: ref,
          },
        ],
      }).valid,
    ).toBe(false);
  });
});
