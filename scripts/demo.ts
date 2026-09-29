import { startRuntime } from './runtime.js';
import { runDemo } from '../apps/demo-client/src/index.js';
const mode = process.argv[2] ?? 'weather';
if (!['weather', 'finance', 'conflicts', 'derived', 'subscribe'].includes(mode))
  throw new Error('Unknown demo mode');
const runtime = await startRuntime();
try {
  await runDemo(runtime.registryUrl, mode);
} finally {
  await runtime.close();
}
