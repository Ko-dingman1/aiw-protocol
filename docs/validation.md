# Validation record

## v0.2 — 2026-09-30

Local Windows validation with Node.js 24.16.0 and pnpm 12.6.0: typecheck, lint, 27 tests across 4 files, build and format checks passed. Offline weather/conflicts/derived/SSE demos and benchmark passed. The compiled live demo successfully retrieved Open-Meteo data with explicit source attribution. Browser checks covered desktop and 390px mobile layout, conflict filtering, derivation input navigation and source details. Hosted CI status is available in the repository Actions tab.

## v0.1 historical record

Validated locally on Windows with Node.js v24.16.0 and pnpm v12.6.0 on 2026-09-29.

| Check               | Result                                                        |
| ------------------- | ------------------------------------------------------------- |
| pnpm install        | Passed; lockfile saved and esbuild install explicitly allowed |
| pnpm typecheck      | Passed                                                        |
| pnpm lint           | Passed                                                        |
| pnpm test           | 16 tests passed across 3 files                                |
| pnpm build          | Passed                                                        |
| pnpm demo           | Registry discovery, direct weather query, ID fetch succeeded  |
| pnpm demo:finance   | Fictional KRX:005930 price returned with source metadata      |
| pnpm demo:conflicts | Both 10231 and 10417 returned from distinct providers         |
| pnpm demo:derived   | Two versioned inputs retained; structural VERIFY passed       |
| pnpm demo:subscribe | Changed weather object received over real HTTP SSE            |
| pnpm benchmark      | Completed 2,000 local iterations per representation           |

Tests cover wire validation, all six object types, AI-origin derivation requirements, exact-version references, optional versus verification metadata, evidence/provenance references, registry upsert and filtering, resolver discovery, query filtering, ID fetch, conflict preservation, SSE receipt/filtering/cancellation, malformed requests, request-size limits, internal-error redaction and invalid remote objects.

One illustrative synthetic run reported HTML 2,719 bytes versus JSON 598 bytes, with local processing times of 1,049.94 ms and 5.38 ms respectively. These are environment-dependent measurements from a synthetic fixture, not a claim about general web retrieval performance. See benchmark.md for exclusions and methodology.

CI is configured for Windows, macOS and Linux on Node 22 and 24. Only the local Windows run has been executed here; hosted CI results are not claimed. The project is not deployed and no external APIs, LLMs, accounts or data sources were used by the demos.
