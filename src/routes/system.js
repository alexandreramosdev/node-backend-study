'use strict';

// ---------------------------------------------------------------------------
// src/routes/system.js
//
// Rotas públicas e simples, úteis para smoke test e health check.
// O handler retorna um ResponseSpec; quem envia a resposta é sendResponse.
// ---------------------------------------------------------------------------

const { json } = require('../core/response');

function registerSystemRoutes(router) {
  router.add('GET', '/', () => json(200, { message: 'Hello World' }));
  router.add('GET', '/health', () => json(200, { status: 'ok' }));
}

module.exports = { registerSystemRoutes };
