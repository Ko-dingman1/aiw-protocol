# Synthetic benchmark

Run pnpm benchmark. Both sources expose the same subject, temperature, unit and timestamp. A runtime assertion checks extracted target equality. The HTML fixture includes navigation, headings, article cards, irrelevant text and a footer. The JSON object includes source/provider/provenance metadata as well as the target fields.

The script performs 100 warm-up parses per representation, then 2,000 measured iterations each. HTML uses Cheerio to parse a DOM and four selectors; JSON uses JSON.parse and four direct field reads. Bytes are UTF-8 before compression. Operation counts are source-level counts, not CPU instruction counts. Validation is excluded from both timing paths. The JSON cast in this isolated benchmark does not replace runtime validation in the production client.

Sample output format (timings depend on machine; placeholders are not measured claims):

```text
SYNTHETIC LOCAL BENCHMARK — no network, LLM or universal speed claim
{
  "iterations": 2000,
  "environment": "v24.x",
  "html": {"bytes": <bytes>, "parsePasses": 1, "selectorOperations": 4, "elapsedMs": <ms>},
  "aiw": {"bytes": <bytes>, "parsePasses": 1, "fieldReads": 4, "elapsedMs": <ms>}
}
```

No network latency, HTTP headers, compression, caching, browser rendering, remote API cost or LLM/token usage is measured. Sequential timing can be affected by JIT, garbage collection and CPU scheduling. Payload composition favors a page with unrelated content; a compact REST JSON response could be similar to or smaller than AIW. This demonstrates the architectural hypothesis only and does not prove AIW universally faster than the Web. Repeated trials, randomized ordering and representative sources would be needed for a rigorous evaluation.
