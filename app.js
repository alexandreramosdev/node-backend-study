'use strict';

// ---------------------------------------------------------------------------
// app.js (raiz)
//
// Este arquivo mantém o uso mais simples possível:
//
//   const app = require('./app');
//   http.createServer(app);
//
// O handler é criado pela fábrica `createApp` (src/app.js), que recebe as
// dependências. Aqui usamos os padrões: repositório em memória e logger comum.
//
// `createApp` também é exportado como propriedade para permitir que testes e
// outros pontos do projeto criem uma aplicação com repositório/logger próprios.
// ---------------------------------------------------------------------------

const { createApp } = require('./src/app');

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
