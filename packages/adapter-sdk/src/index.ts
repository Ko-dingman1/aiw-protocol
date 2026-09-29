import type { KnowledgeObject } from '../../core/src/index.js';
/** Convert existing data; storage and transport remain outside this interface. */
export interface Adapter<Source> {
  readonly id: string;
  convert(source: Source): KnowledgeObject[];
}
