import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import {
  AiwError,
  type KnowledgeObject,
} from '../../../packages/core/src/index.js';
import type { WeatherStatus } from '../../../packages/adapter-sdk/src/open-meteo.js';

export interface DashboardOptions {
  registryUrl: () => string;
  nodeUrl: () => string;
  mode: 'mock' | 'live';
  status: () => WeatherStatus;
  refresh?: () => Promise<KnowledgeObject>;
}

export function registerDashboard(
  app: FastifyInstance,
  options: DashboardOptions,
): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header(
      'content-security-policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' " +
        new URL(options.registryUrl()).origin +
        "; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    return payload;
  });
  for (const [route, file, type] of [
    ['/', 'index.html', 'text/html'],
    ['/app.js', 'app.js', 'text/javascript'],
    ['/style.css', 'style.css', 'text/css'],
  ] as const) {
    app.get(route, async (_request, reply) =>
      reply
        .type(type)
        .send(
          await readFile(new URL('../public/' + file, import.meta.url), 'utf8'),
        ),
    );
  }
  app.get('/dashboard-config', async () => ({
    protocolVersion: '0.2',
    registryUrl: options.registryUrl(),
    nodeUrl: options.nodeUrl(),
    mode: options.mode,
  }));
  app.get('/source-status', async () => ({
    mode: options.mode,
    ...options.status(),
  }));
  app.post('/refresh', async (request) => {
    if (
      request.headers['x-aiw-request'] !== 'dashboard' ||
      (request.headers.origin &&
        request.headers.origin !== new URL(options.nodeUrl()).origin)
    ) {
      throw new AiwError(
        'AIW_ACCESS_DENIED',
        'Refresh requires a same-origin dashboard request',
        403,
      );
    }
    if (!options.refresh)
      throw new AiwError(
        'AIW_CAPABILITY_UNSUPPORTED',
        'Start pnpm dev:live to use external weather data',
      );
    return { object: await options.refresh(), status: options.status() };
  });
}
