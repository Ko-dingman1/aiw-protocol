# Related technologies

AIW explores machine-agent-oriented knowledge discovery and exchange. This is an experimental combination of familiar ideas, not a claim of being the first AI internet.

| Technology                      | Relationship to this prototype                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Traditional REST APIs           | Already expose machine-readable resources. AIW itself uses REST-like HTTP endpoints, adding a shared envelope and discovery convention for this experiment.                      |
| RDF / Semantic Web              | Offers graph-based data modeling and links using shared identifiers. AIW's small JSON envelope lacks RDF semantics and reasoning; adapters could map between them.               |
| JSON-LD                         | Connects JSON terms to linked-data vocabularies. AIW currently has no context processing; interoperability is a future experiment.                                               |
| Knowledge graphs                | Model entities and relationships, often with graph querying and storage. AIW is an exchange layer and can potentially wrap a graph, not replace it.                              |
| MCP                             | Connects AI applications to tools and contextual resources. An MCP adapter could expose AIW discovery and retrieval to an existing ecosystem. No MCP implementation is included. |
| A2A-style communication         | Supports cooperation between agents. AIW focuses on discoverable knowledge objects rather than agent task negotiation.                                                           |
| Machine-readable web interfaces | APIs, structured markup and linked-data interfaces already reduce UI extraction needs. They are complementary sources and prior art.                                             |

These are scope comparisons, not benchmarks or claims that competing technologies lack capabilities. Production tradeoffs need real deployments and interoperability tests.

Primary references: [W3C RDF Primer](https://www.w3.org/TR/rdf-primer/), [W3C JSON-LD 1.1](https://www.w3.org/TR/json-ld11/), [MCP specification release](https://blog.modelcontextprotocol.io/posts/2026-07-28/), [A2A project](https://a2a-protocol.org/). Runtime compatibility: [Node.js releases](https://nodejs.org/en/about/previous-releases), [Fastify v5 migration](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/).
