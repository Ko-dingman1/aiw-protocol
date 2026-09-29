import { startRuntime } from './runtime.js';
const mode = process.argv.includes('--live') ? 'live' : 'mock';
const runtime = await startRuntime(4000, 4001, 1000, { mode });
console.log(
  'Registry: ' +
    runtime.registryUrl +
    ' | Node: ' +
    runtime.nodeUrl +
    ' | Dashboard: ' +
    runtime.nodeUrl +
    ' (' +
    mode +
    ') | Ctrl+C to stop',
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void runtime.close().then(() => {
      process.exitCode = 0;
    });
  });
