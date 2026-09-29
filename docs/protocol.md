# HTTP protocol v0.1

All JSON request/response bodies use application/json; the descriptor's protocolVersion is "0.1". No custom URI or transport is introduced. Clients receive complete candidate descriptors and connect directly to the endpoint root.

| Operation | Endpoint                    | Request                                             | Success                                       |
| --------- | --------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Register  | POST /nodes (registry)      | NodeDescriptor                                      | 201 descriptor; same nodeId replaces metadata |
| List      | GET /nodes (registry)       | none                                                | 200 {nodes: [...]}                            |
| DISCOVER  | GET /discover (registry)    | optional namespace, schema, capability query params | 200 {nodes: [...]}                            |
| Describe  | GET /.well-known/aiw (node) | none                                                | 200 NodeDescriptor                            |
| QUERY     | POST /query (node)          | JSON filter, {} for all                             | 200 {objects: [...]}                          |
| FETCH     | GET /objects/:id (node)     | URL-encoded opaque ID                               | 200 KnowledgeObject                           |
| SUBSCRIBE | GET /subscribe (node)       | same filters in query string                        | 200 text/event-stream                         |
| VERIFY    | local verify()              | object + available referenced objects               | {valid, issues}                               |

Resolver.resolve() calls /discover over HTTP and throws AIW_NODE_NOT_FOUND when no candidate exists. There is no separate /resolve service in this MVP.

Discovery filters use AND with exact string equality. Query supports namespace, subject, property, type and provider (provider ID), also AND/exact match. An empty result is legitimate; an unsupported namespace is a 400 error. Unknown filter keys are rejected. No sorting, pagination or query language exists.

The descriptor requires protocolVersion, nodeId, endpoint (HTTP/S), provider (operator), namespaces, schemas and capabilities. Object providers need not equal descriptor.provider. Supported capabilities are query, fetch and subscribe. The registry validates but does not probe endpoints or authenticate registrations.

SSE sends event: object and a JSON data line, with blank-line frame separators. It starts with a connected comment, sends heartbeat comments every 15 seconds, and publishes changed weather observations every second. Filters apply to updates only; query first for an initial snapshot. There are no event IDs, resume cursors, replay or ordering guarantees across nodes. Slow connections are closed rather than buffered without bounds. Client cancellation releases the stream; server shutdown closes subscriptions.

## Errors

```json
{ "error": { "code": "AIW_OBJECT_NOT_FOUND", "message": "Object not found" } }
```

Invalid registration: AIW_SCHEMA_INVALID (400). Invalid filter/JSON: AIW_QUERY_INVALID (400). Unsupported namespace: AIW_NAMESPACE_UNSUPPORTED (400). Missing object or no resolver candidates: AIW_OBJECT_NOT_FOUND / AIW_NODE_NOT_FOUND (404). Internal failures: AIW_INTERNAL_ERROR (500), with internal details suppressed. The client reports AIW_CAPABILITY_UNSUPPORTED before requesting an unadvertised operation; AIW_ACCESS_DENIED is reserved for future authorization. Invalid remote envelopes become AIW_SCHEMA_INVALID. Nonexistent routes use the same error envelope.

Bodies are limited to 64 KiB by the apps. Regular client requests time out after five seconds. SSE defaults to a 30-second abort signal unless the caller supplies one. This is a bounded demo client, not an automatic reconnection implementation.
