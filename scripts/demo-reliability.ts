import { createNode } from '../apps/weather-node/src/index.js';
import { fixtures, descriptor } from '../examples/fixtures.js';
import { AiwClient } from '../packages/client/src/index.js';
let endpoint = 'http://127.0.0.1';
const initial = fixtures();
const app = createNode(initial, () => descriptor(endpoint), 1000, {
  simulateWeather: false,
});
try {
  endpoint = await app.listen({ host: '127.0.0.1', port: 0 });
  const client = new AiwClient(descriptor(endpoint));
  console.log(
    'Domain schemas:',
    (await client.schemas()).schemas.map((schema) => schema.id),
  );
  try {
    app.publishKnowledge({ ...initial[0]!, version: 2, unit: 'F' });
    throw new Error('Invalid unit unexpectedly accepted');
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes('Domain validation failed')
    )
      throw error;
    console.log('Invalid unit rejected:', error.message);
  }
  app.publishKnowledge({ ...initial[0]!, version: 2, value: 20.1 });
  console.log(
    'Original value:',
    (await client.fetch('weather:seoul', 1)).value,
    'Latest:',
    (await client.fetch('weather:seoul')).value,
  );
  console.log('History:', await client.history('weather:seoul'));
  const first = await client.queryPage({ property: 'employeeCount', limit: 1 });
  const second = await client.queryPage({
    property: 'employeeCount',
    limit: 1,
    cursor: first.nextCursor,
  });
  console.log(
    'Conflicting claims across pages:',
    first.objects[0]?.value,
    second.objects[0]?.value,
  );
  app.publishKnowledge({ ...initial[2]!, version: 2, value: 12000 });
  console.log(
    'Derivation still resolves version 1:',
    await client.verify('employees:range'),
  );
} finally {
  await app.close();
}
