# Contributing

Use Node.js 24 LTS and pnpm 12. Run pnpm install, then pnpm typecheck, pnpm lint, pnpm test, pnpm build and pnpm format:check. Run relevant demos for behavior changes. pnpm format applies formatting. Build artifacts are ignored.

Keep strict TypeScript, small modules and runtime validation at trust boundaries. Add tests for behavioral changes, preserve contradictory providers, and never present fictional data as live observations. Explain contract changes and migration implications. New authentication or ontology work should begin with a focused design discussion. Avoid unsupported novelty/performance claims.

The repo is a private-package workspace prototype, not published npm packages. Source imports intentionally remain relative so the single root TypeScript build emits portable runnable JavaScript without package build orchestration. Treat package directories as architectural boundaries; publishable packages can be designed later.

Do not commit secrets, node_modules, dist or generated logs. Contributions are licensed under MIT.
