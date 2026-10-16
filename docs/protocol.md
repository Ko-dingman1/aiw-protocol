# HTTP protocol v0.3

All JSON request/response bodies use application/json; the descriptor's protocolVersion is "0.3". No custom URI or transport is introduced. Clients receive complete candidate descriptors and connect directly to the endpoint root.

| Operation | Endpoint                     | Request                                             | Success                                       |
| --------- | ---------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Register  | POST /nodes (registry)       | NodeDescriptor                                      | 201 descriptor; same nodeId replaces metadata |
| List      | GET /nodes (registry)        | none                                                | 200 {nodes: [...]}                            |
| DISCOVER  | GET /discover (registry)     | optional namespace, schema, capability query params | 200 {nodes: [...]}                            |
| Describe  | GET /.well-known/aiw (node)  | none                                                | 200 NodeDescriptor                            |
| QUERY     | POST /query (node)           | JSON filters, limit and cursor                      | 200 {objects: [...], nextCursor?}             |
| FETCH     | GET /objects/:id (node)      | URL-encoded opaque ID, optional version query       | 200 KnowledgeObject                           |
| HISTORY   | GET /objects/:id/history     | URL-encoded opaque ID                               | 200 retained versions and limits              |
| SCHEMAS   | GET /schemas or /schemas/:id | optional URL-encoded schema ID                      | 200 catalog or domain schema                  |
| VERIFY    | GET /objects/:id/verify      | optional version query                              | 200 {valid, issues}                           |
| SUBSCRIBE | GET /subscribe (node)        | same filters in query string                        | 200 text/event-stream                         |
| VERIFY    | local verify()               | object + available referenced objects               | {valid, issues}                               |

Resolver.resolve() calls /discover over HTTP and throws AIW_NODE_NOT_FOUND when no candidate exists. There is no separate /resolve service in this MVP.

Discovery filters use AND with exact string equality. Query supports namespace, schema, subject, property, type and provider (provider ID), also AND/exact match. An empty result is legitimate; an unsupported namespace is a 400 error. Unknown filter keys are rejected. Query pages contain at most 100 objects (default 50), ordered by ID using JavaScript string ordering. Pass nextCursor as cursor with the same filters to continue. Pages are live views, not snapshots; concurrent changes can affect later pages. See [v0.3 contracts](v0.3.md).

The descriptor requires protocolVersion, nodeId, endpoint (HTTP/S), provider (operator), namespaces, schemas and capabilities. Object providers need not equal descriptor.provider. Supported capabilities are query, fetch, subscribe, history, schemas and verify. The registry validates but does not probe endpoints or authenticate registrations.

SSE sends event: object and a JSON data line, with blank-line frame separators. It starts with a connected comment, sends heartbeat comments every 15 seconds, and publishes changed weather observations every second. Filters apply to updates only; query first for an initial snapshot. There are no event IDs, resume cursors, replay or ordering guarantees across nodes. Slow connections are closed rather than buffered without bounds. Client cancellation releases the stream; server shutdown closes subscriptions.

## Errors

```json
{ "error": { "code": "AIW_OBJECT_NOT_FOUND", "message": "Object not found" } }
```

Invalid registration: AIW_SCHEMA_INVALID (400). Invalid filter/JSON: AIW_QUERY_INVALID (400). Unsupported namespace: AIW_NAMESPACE_UNSUPPORTED (400). Missing object or no resolver candidates: AIW_OBJECT_NOT_FOUND / AIW_NODE_NOT_FOUND (404). Internal failures: AIW_INTERNAL_ERROR (500), with internal details suppressed. The client reports AIW_CAPABILITY_UNSUPPORTED before requesting an unadvertised operation; AIW_ACCESS_DENIED is reserved for future authorization. Invalid remote envelopes become AIW_SCHEMA_INVALID. Nonexistent routes use the same error envelope.

Bodies are limited to 64 KiB by the apps. Regular client requests time out after five seconds. SSE defaults to a 30-second abort signal unless the caller supplies one. This is a bounded demo client, not an automatic reconnection implementation.

Version conflicts use AIW_VERSION_CONFLICT (409). An unavailable requested version uses AIW_VERSION_UNAVAILABLE (410), whether unpublished or pruned. Object or retained-data capacity failures use AIW_RESOURCE_LIMIT (413). History is bounded and stored only in memory.

## Dashboard helper routes (v0.2)

These are local application routes, not universal AIW protocol operations. GET / serves the UI; GET /dashboard-config returns local registry/node URLs and mode; GET /source-status returns state, lastAttemptAt, lastSuccessAt, nextRefreshAt and optional error. POST /refresh requires x-aiw-request: dashboard and, when supplied, a matching Origin. It returns {object, status}; upstream failure returns AIW_UPSTREAM_UNAVAILABLE (503). Mock mode rejects live refresh. The API cooldown is 60 seconds, including failures.

Live SSE events occur when a successful manual refresh publishes a newer object. There is no background external API polling. The browser reconnects SSE automatically but does not recover missed events; use the query button to resynchronize.
