'use strict';

// ---------------------------------------------------------------------------
// app.js (raiz)
//
// Ponto de entrada "de biblioteca" do projeto. O modo recomendado de executar
// é `server.js` (npm start), que carrega config, repositório e autenticação.
//
// Por segurança, este arquivo NÃO exporta mais um handler pronto sem auth.
// Exportamos a fábrica `createApp`, que exige `config.authToken` por padrão:
//
//   const { createApp } = require('./app');
//   const app = createApp({ config: { authToken: process.env.AUTH_TOKEN } });
//   http.createServer(app);
//
// Para testes, a desativação precisa ser explícita: createApp({ config: { auth: false } }).
// ---------------------------------------------------------------------------

const { createApp } = require('./src/app');

module.exports = { createApp };
