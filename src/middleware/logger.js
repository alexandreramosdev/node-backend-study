'use strict';

// ---------------------------------------------------------------------------
// src/middleware/logger.js
//
// Middleware de log por requisição. Ele envolve o restante da cadeia:
//
//   antes: marca o horário;
//   await next(): executa rota;
//   depois: calcula a duração e loga o status final.
//
// Se a cadeia lançar, logamos mesmo assim antes de repassar o erro. O ideal é
// que o errorHandler (mais interno) já tenha convertido o erro em resposta;
// este catch é uma proteção extra.
// ---------------------------------------------------------------------------

const { logRequest } = require('../logger');
const { AppError } = require('../core/errors');

function elapsedMs(startedAt) {
  // process.hrtime.bigint() é monotônico e não é afetado por mudanças de relógio.
  return Number(process.hrtime.bigint() - startedAt) / 1e6;
}

function requestLogger(logger) {
  return async function requestLoggerMiddleware(ctx, next) {
    const startedAt = process.hrtime.bigint();

    try {
      const spec = await next();

      logRequest(logger, {
        requestId: ctx.requestId,
        method: ctx.method,
        pathname: ctx.pathname,
        status: spec ? spec.status : 200,
        durationMs: elapsedMs(startedAt)
      });

      return spec;
    } catch (err) {
      const status = err instanceof AppError ? err.status : 500;

      logRequest(logger, {
        requestId: ctx.requestId,
        method: ctx.method,
        pathname: ctx.pathname,
        status,
        durationMs: elapsedMs(startedAt)
      });

      if (status >= 500) {
        // Stack trace só no log interno.
        logger.error('request failed', {
          requestId: ctx.requestId,
          error: err && err.stack ? err.stack : String(err)
        });
      }

      throw err;
    }
  };
}

module.exports = { requestLogger };
