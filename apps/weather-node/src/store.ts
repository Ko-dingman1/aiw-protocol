import { isDeepStrictEqual } from 'node:util';
import {
  AiwError,
  type KnowledgeObject,
  verify,
} from '../../../packages/core/src/index.js';
import { validateDomain } from '../../../packages/core/src/schemas.js';

export class KnowledgeStore {
  private objects = new Map<string, KnowledgeObject[]>();
  readonly retentionLimit: number;
  private maxObjects: number;
  private maxBytes: number;
  private storedBytes = 0;
  constructor(
    initial: KnowledgeObject[],
    options: {
      retentionLimit?: number;
      maxObjects?: number;
      maxBytes?: number;
    } = {},
  ) {
    this.retentionLimit = options.retentionLimit ?? 100;
    this.maxObjects = options.maxObjects ?? 1000;
    this.maxBytes = options.maxBytes ?? 16 * 1024 * 1024;
    if (
      !Number.isSafeInteger(this.maxBytes) ||
      this.maxBytes < 1 ||
      this.maxBytes > 256 * 1024 * 1024
    )
      throw new Error('Invalid byte limit');
    if (
      !Number.isInteger(this.retentionLimit) ||
      this.retentionLimit < 1 ||
      this.retentionLimit > 100 ||
      !Number.isInteger(this.maxObjects) ||
      this.maxObjects < 1 ||
      this.maxObjects > 10000
    )
      throw new Error('Invalid store limits');
    for (const object of initial) this.put(object);
  }
  put(input: KnowledgeObject): boolean {
    const object = validateDomain(input);
    if (Buffer.byteLength(JSON.stringify(object)) > 65536)
      throw new AiwError('AIW_RESOURCE_LIMIT', 'Object exceeds 64 KiB', 413);
    const history = this.objects.get(object.id) ?? [];
    const latest = history.at(-1);
    const existing = history.find((item) => item.version === object.version);
    if (existing && isDeepStrictEqual(existing, object)) return false;
    if (latest) {
      if (object.version <= latest.version)
        throw new AiwError(
          'AIW_VERSION_CONFLICT',
          'Versions are immutable and must increase',
          409,
        );
      if (
        ['schema', 'namespace', 'subject', 'property', 'createdAt'].some(
          (key) =>
            object[key as keyof KnowledgeObject] !==
            latest[key as keyof KnowledgeObject],
        ) ||
        object.provider.id !== latest.provider.id
      )
        throw new AiwError(
          'AIW_VERSION_CONFLICT',
          'Object identity and creation metadata cannot change',
          409,
        );
    } else if (this.objects.size >= this.maxObjects)
      throw new AiwError(
        'AIW_RESOURCE_LIMIT',
        'Node object capacity reached',
        413,
      );
    const bytes = Buffer.byteLength(JSON.stringify(object));
    const evictedBytes =
      history.length >= this.retentionLimit
        ? Buffer.byteLength(JSON.stringify(history[0]))
        : 0;
    if (this.storedBytes + bytes - evictedBytes > this.maxBytes)
      throw new AiwError(
        'AIW_RESOURCE_LIMIT',
        'Node retained data byte capacity reached',
        413,
      );
    history.push(structuredClone(object));
    if (history.length > this.retentionLimit) history.shift();
    this.objects.set(object.id, history);
    this.storedBytes += bytes - evictedBytes;
    return true;
  }
  get(id: string, version?: number): KnowledgeObject {
    const history = this.objects.get(id);
    if (!history)
      throw new AiwError('AIW_OBJECT_NOT_FOUND', 'Object not found', 404);
    const object =
      version === undefined
        ? history.at(-1)
        : history.find((item) => item.version === version);
    if (!object)
      throw new AiwError(
        'AIW_VERSION_UNAVAILABLE',
        'Requested version is not retained; inspect object history',
        410,
      );
    return structuredClone(object);
  }
  latest(): KnowledgeObject[] {
    return [...this.objects.values()].map((history) =>
      structuredClone(history.at(-1)!),
    );
  }
  history(id: string) {
    const history = this.objects.get(id);
    if (!history)
      throw new AiwError('AIW_OBJECT_NOT_FOUND', 'Object not found', 404);
    return {
      id,
      versions: history.map((item) => item.version).reverse(),
      retained: history.length,
      retentionLimit: this.retentionLimit,
      oldestAvailableVersion: history[0]!.version,
    };
  }
  verify(id: string, version?: number) {
    const object = this.get(id, version);
    const references = [
      ...(object.derivedFrom ?? []),
      ...(object.evidence ?? []).flatMap((item) =>
        item.object ? [item.object] : [],
      ),
      ...(object.provenance ?? []).flatMap((item) =>
        item.input ? [item.input] : [],
      ),
    ];
    const available = references.flatMap((ref) => {
      try {
        return [this.get(ref.id, ref.version)];
      } catch (error) {
        if (error instanceof AiwError && [404, 410].includes(error.status))
          return [];
        throw error;
      }
    });
    return verify(object, available);
  }
}
