# Implementation plan

1. Inspect the empty workspace and target Node.js 24 LTS with pnpm.
2. Define public contracts in core: knowledge, descriptors, filters, verification, errors and future authorization. Core has no HTTP or storage dependencies.
3. Implement core and validation tests first. Adapter SDK converts source records; it does not own storage.
4. Build an in-memory Fastify registry for descriptors only, then a resolver package that discovers through HTTP.
5. Build a fixture-backed node with query, fetch and bounded SSE update delivery. Keep providers separate from node identity.
6. Build a validated HTTP client and self-contained demo runner with actual registry → resolver → node traffic.
7. Add fictional weather, finance, conflicting-provider and deterministic derivation examples.
8. Add a synthetic HTML/JSON benchmark with explicit methodology and limitations.
9. Document contracts, architectural choices, prior art, security limitations and contribution workflow in English and Korean.
10. Run install, typecheck, lint, tests, build, all demos and benchmark; repair failures.

## Boundaries

- `packages/core`: Zod wire contracts and structural verification.
- `packages/adapter-sdk`: source conversion interface.
- `packages/resolver`: registry lookup, no knowledge proxy.
- `packages/client`: validated HTTP discovery/query/fetch and SSE consumption.
- `apps/registry`: metadata control plane.
- `apps/weather-node`: reusable in-memory knowledge endpoint hosting all mock examples.
- `apps/demo-client`: command-line agent using discovery.
- `scripts`: lifecycle orchestration and benchmark.

The resolver is a library, not a mandatory additional service. One node hosts multiple providers and namespaces to avoid unnecessary processes. IDs are opaque strings; derivation references use object ID and version. Verification checks supplied references but cannot authenticate sources or determine truth.
