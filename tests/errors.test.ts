import { it, expect } from 'vitest';
import Fastify from 'fastify';
import { createNode } from '../apps/weather-node/src/index.js';
import { installErrors } from '../apps/shared/http.js';
import { fixtures, descriptor } from '../examples/fixtures.js';
import { AiwClient } from '../packages/client/src/index.js';

it('retains request-limit status codes in the common error envelope', async () => {
  const app = createNode(fixtures(), () => descriptor('http://localhost'));
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { subject: 'x'.repeat(70000) },
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('AIW_QUERY_INVALID');
  } finally {
    await app.close();
  }
});

it('does not disclose internal failure details', async () => {
  const app = Fastify();
  installErrors(app);
  app.get('/failure', async () => {
    throw new Error('private implementation detail');
  });
  try {
    const response = await app.inject('/failure');
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'AIW_INTERNAL_ERROR', message: 'Internal server error' },
    });
  } finally {
    await app.close();
  }
});

it('rejects invalid objects returned by a remote node', async () => {
  const app = Fastify();
  app.post('/query', async () => ({ objects: [{ id: 'incomplete' }] }));
  const endpoint = await app.listen({ host: '127.0.0.1', port: 0 });
  try {
    await expect(
      new AiwClient(descriptor(endpoint)).query(),
    ).rejects.toMatchObject({ code: 'AIW_SCHEMA_INVALID' });
  } finally {
    await app.close();
  }
});
