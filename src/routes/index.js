'use strict';

// ---------------------------------------------------------------------------
// src/routes/index.js
//
// Ponto único de registro das rotas. Mantém a composição explícita e facilita
// adicionar novos recursos no futuro (ex.: registerUserRoutes).
// ---------------------------------------------------------------------------

const { registerSystemRoutes } = require('./system');
const { registerTaskRoutes } = require('./tasks');

function registerRoutes(router, deps) {
  registerSystemRoutes(router);
  registerTaskRoutes(router, deps);
}

module.exports = { registerRoutes };
