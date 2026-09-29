# Prototype security boundaries

The launcher binds both services to 127.0.0.1. Use only trusted local mock data and registrations. Registrations are unauthenticated upserts. There is no identity proof, ownership check, tenant isolation, rate limiting or production access policy. A discovered endpoint is an untrusted network destination unless the registry is trusted; a deployment must enforce outbound destination policy to prevent SSRF. The registry itself never fetches submitted endpoints.

Zod validates wire shapes, Fastify limits request bodies, regular client requests have timeouts, SSE frames are bounded, and slow subscribers are disconnected. These are basic boundaries, not a production security claim. No secrets or external stock API calls exist.

core exports AuthorizationPolicy as an integration interface only. It is not connected to routes. Future deployments may integrate OAuth/OIDC, mTLS or managed API keys depending on their environment, using established libraries rather than custom authentication. A public deployment needs authentication/authorization, endpoint allowlisting, quotas, TLS and operational review first.

VERIFY does not authenticate metadata or prove truth. Consumers must treat source descriptions, evidence and derived values as provider assertions. AI-origin labels improve transparency only when publishers report them honestly.
