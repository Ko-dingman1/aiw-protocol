# Terminology

| Term             | Meaning                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| Agent            | Machine client; does not need an LLM                                             |
| Node             | HTTP endpoint exposing Knowledge Objects, independent of source ownership        |
| Provider         | Organization/person/service responsible for publishing an object                 |
| Adapter          | Converts source-specific records into Knowledge Objects                          |
| Knowledge Object | Typed, machine-readable information envelope; not automatically a fact           |
| Schema           | Meaning/structure identifier, with no full ontology system in v0.2               |
| Namespace        | Logical domain such as weather.kr, finance.krx, science.physics or software.npm  |
| Registry         | Node metadata directory, not a knowledge store                                   |
| Resolver         | Finds candidate locations using the registry                                     |
| Source           | Where information originated                                                     |
| Evidence         | Supporting assertion, URL or referenced object                                   |
| Provenance       | Transformations between source and published object                              |
| Control plane    | Discovery, registry, resolver, namespace/schema/capability metadata              |
| Knowledge plane  | Query, fetch, objects, sources, provenance, evidence, versions and subscriptions |

Source and provider may name the same party in some deployments, but represent different roles. A node operator may host information from many providers. Namespace strings do not imply DNS ownership or aiw:// URLs.
