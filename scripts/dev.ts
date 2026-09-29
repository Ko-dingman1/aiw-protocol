import { startRuntime } from './runtime.js';
const runtime = await startRuntime(4000, 4001);
console.log(
  'Registry: ' +
    runtime.registryUrl +
    ' | Node: ' +
    runtime.nodeUrl +
    ' | Ctrl+C to stop',
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void runtime.close().then(() => {
      process.exitCode = 0;
    });
  });
