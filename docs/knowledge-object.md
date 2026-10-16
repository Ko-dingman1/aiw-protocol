# Knowledge Object v0.1

The authoritative contract is packages/core/src/index.ts (Zod + inferred TypeScript). Objects are strict: unknown top-level fields are rejected in this prototype.

| Required field      | Meaning                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| id                  | Opaque object identifier; unique inside a node                                                     |
| type                | observation, claim, inference, record, event, document-reference                                   |
| schema              | Domain schema identifier; not automatically downloaded                                             |
| namespace           | Logical domain, not a URI protocol                                                                 |
| subject / property  | Entity and attribute identifiers                                                                   |
| value               | Any valid JSON value, including null                                                               |
| provider            | Publishing party with id and display name                                                          |
| originType          | measurement, official-record, human-statement, research, imported-data, ai-inference, derived-data |
| createdAt / version | UTC ISO timestamp and positive integer version                                                     |

Optional fields: unit, source, observedAt, updatedAt, evidence, provenance, derivedFrom. Metadata strings are bounded to 512 characters; reference/evidence/provenance lists to 100 entries. createdAt records initial creation; updatedAt and version change with updates. observedAt identifies the measurement time. No automatic freshness judgement is made.

Source has id, description, optional URL and mock flag. Evidence has description plus optional object reference or URL. Provenance entries have activity, agent, timestamp and optional input reference. An input reference is {id, version}. Node operator and publishing provider can differ.

Both ai-inference and derived-data require a nonempty derivedFrom. Direct self-reference to the same version is rejected. These origins remain separate from object type: an inference can be deterministic or AI-generated. The current example uses derived-data honestly because no model runs.

VERIFY is the exported verify(input, availableObjects) function. It validates the envelope, requires source and provenance for its stricter metadata audit, and checks that derivation, evidence-object and provenance-input references are present at exact versions. Missing optional metadata can therefore be valid on the wire but fail this audit. URLs are not fetched; provider identity, source authenticity, freshness and truth are not verified. Since v0.3, the node validates domain values and units at ingestion using its fixed schema catalog, and exposes server verification against retained exact input versions. A remotely writable schema registry remains future work.

IDs are node-local. Cross-node derivations, historical retrieval and recursive graph verification remain future design questions. Optional metadata is intentionally small rather than a complete ontology.
