import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AiwError } from '../../packages/core/src/index.js';
export function installErrors(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    const known =
      error instanceof AiwError
        ? error
        : error instanceof ZodError
          ? new AiwError('AIW_QUERY_INVALID', 'Request validation failed')
          : new AiwError('AIW_INTERNAL_ERROR', 'Internal server error', 500);
    if (
      !(error instanceof AiwError) &&
      !(error instanceof ZodError) &&
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      [400, 413, 415].includes(error.statusCode)
    ) {
      return reply.code(error.statusCode).send({
        error: { code: 'AIW_QUERY_INVALID', message: 'Malformed request' },
      });
    }
    return reply
      .code(known.status)
      .send({ error: { code: known.code, message: known.message } });
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({
      error: { code: 'AIW_OBJECT_NOT_FOUND', message: 'Route not found' },
    }),
  );
}
