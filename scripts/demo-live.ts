import { startRuntime } from './runtime.js';
import { RegistryResolver } from '../packages/resolver/src/index.js';
import { AiwClient } from '../packages/client/src/index.js';
const runtime = await startRuntime(0, 0, 1000, { mode: 'live' });
try {
  const [node] = await new RegistryResolver(runtime.registryUrl).resolve({
    namespace: 'weather.kr',
    capability: 'query',
  });
  const objects = await new AiwClient(node!).query({ namespace: 'weather.kr' });
  if (!objects.length)
    throw new Error(
      'Live weather unavailable. No mock fallback was used. Check /source-status in the dashboard.',
    );
  console.log('Live API → adapter → Node ← Agent ← Resolver ← Registry');
  console.log(JSON.stringify(objects, null, 2));
  console.log(
    'Weather data by Open-Meteo (https://open-meteo.com/), CC BY 4.0. Model data, not sensor measurement.',
  );
} finally {
  await runtime.close();
}
