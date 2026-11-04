'use strict';

// ---------------------------------------------------------------------------
// src/middleware/error-handler.js
//
// Fronteira de erro da aplicação: qualquer exceção lançada pelos middlewares
// internos ou pela rota é capturada aqui e convertida em ResponseSpec.
//
// - AppError 4xx: mensagem controlada, sem log de stack.
// - AppError 5xx ou erro desconhecido: loga o stack internamente e responde
//   apenas INTERNAL_ERROR.
//
// É por causa deste middleware que as rotas podem simplesmente `throw notFound()`.
// ---------------------------------------------------------------------------

const { AppError, toResponseSpec } = require('../core/errors');

function errorHandler({ logger } = {}) {
  return async function errorHandlerMiddleware(ctx, next) {
    try {
      return await next();
    } catch (err) {
      if (logger && (!(err instanceof AppError) || err.status >= 500)) {
        logger.error('unexpected request error', {
          requestId: ctx.requestId,
          error: err && err.stack ? err.stack : String(err)
        });
      }

      return toResponseSpec(err);
    }
  };
}

module.exports = { errorHandler };
