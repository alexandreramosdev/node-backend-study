'use strict';

// ---------------------------------------------------------------------------
// src/app.js
//
// Fábrica da aplicação HTTP. O fluxo de cada requisição é:
//
//   handler HTTP
//     -> parseRequest (método, path, query, headers)
//     -> middlewares em "cebola":
//          requestLogger -> errorHandler -> routeResolver -> auth -> jsonBody
//     -> handler da rota (routes/*.js)
//     -> sendResponse (serializa o ResponseSpec)
//
// Detalhe importante: o roteamento acontece ANTES da autenticação e do body
// parser. Assim, uma rota inexistente devolve 404 e um método inválido devolve
// 405 sem exigir token nem ler o corpo da requisição.
//
// Os middlewares e handlers não escrevem diretamente em `res`: eles retornam um
// objeto `ResponseSpec` ({ status, headers, body }). O envio fica centralizado.
// ---------------------------------------------------------------------------

const { randomUUID } = require('node:crypto');
const { compose } = require('./core/compose');
const { parseRequest } = require('./core/request');
const { sendResponse } = require('./core/response');
const { createRouter } = require('./core/router');
const {
  notFound,
  methodNotAllowed,
  toResponseSpec
} = require('./core/errors');
const { createLogger, logRequest } = require('./logger');
const { requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/error-handler');
const { bearerAuth } = require('./middleware/auth');
const { jsonBody } = require('./middleware/json-body');
const { createMemoryRepository } = require('./repositories/memory');
const { registerRoutes } = require('./routes');

// Middleware que transforma método + path em um handler de rota.
// Ele roda antes dos demais para que 404/405 sejam decididos primeiro.
function routeResolver(router) {
  return async function routeResolverMiddleware(ctx, next) {
    const result = router.resolve(ctx.method, ctx.pathname);

    if (result.type === 'not_found') {
      throw notFound();
    }

    if (result.type === 'method_not_allowed') {
      throw methodNotAllowed(result.allowedMethods);
    }

    ctx.params = result.params;
    ctx.route = result.handler;

    return next();
  };
}

// `createApp` recebe dependências com valores padrão para facilitar o uso.
// Injetar `now` e `uuid` permite testes determinísticos de data e id.
function createApp({
  repository = createMemoryRepository(),
  logger = createLogger(),
  config = {},
  now = () => new Date(),
  uuid = () => randomUUID()
} = {}) {
  const router = createRouter();
  registerRoutes(router, { repository, now, uuid });

  // A ordem importa:
  // - requestLogger mede a duração e loga o status final;
  // - errorHandler converte exceções em resposta segura;
  // - routeResolver escolhe a rota;
  // - auth protege apenas os métodos de escrita;
  // - jsonBody lê e valida o Content-Type/JSON.
  const middlewares = [
    requestLogger(logger),
    errorHandler({ logger }),
    routeResolver(router)
  ];

  if (config.authToken) {
    middlewares.push(bearerAuth({ token: config.authToken }));
  }

  middlewares.push(jsonBody({ limit: config.bodyLimit }));

  // O último "middleware" é o handler da rota resolvida (ctx.route).
  const run = compose(middlewares, (ctx) => ctx.route(ctx));

  return async function handler(req, res) {
    const requestId = uuid();
    const startedAt = process.hrtime.bigint();

    // O id ajuda a correlacionar logs e resposta sem expor dados internos.
    res.setHeader('X-Request-Id', requestId);

    try {
      const parsed = parseRequest(req);
      const ctx = { ...parsed, requestId, logger };
      const spec = await run(ctx);

      sendResponse(res, spec);
    } catch (err) {
      // Este catch cobre erros que acontecem ANTES dos middlewares, como uma
      // URL malformada em parseRequest. Erros dentro dos middlewares são
      // tratados pelo errorHandler e chegam aqui já convertidos em spec.
      const spec = toResponseSpec(err);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const pathname =
        typeof req.url === 'string' ? req.url.split('?')[0] : '/';

      sendResponse(res, spec);

      logRequest(logger, {
        requestId,
        method: (req.method || 'GET').toUpperCase(),
        pathname,
        status: spec.status,
        durationMs
      });

      if (spec.status >= 500) {
        // O stack trace fica somente no log interno; o cliente recebe o
        // contrato genérico de erro.
        logger.error('request failed before routing', {
          requestId,
          error: err && err.stack ? err.stack : String(err)
        });
      }
    }
  };
}

module.exports = { createApp };
