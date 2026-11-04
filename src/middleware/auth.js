'use strict';

// ---------------------------------------------------------------------------
// src/middleware/auth.js
//
// Autenticação didática por token estático (Bearer). Só protege os métodos de
// escrita; GET continua público.
//
// Por que hash + timingSafeEqual?
// - comparar strings com `===` pode retornar mais rápido no primeiro byte
//   diferente, vazando informação por tempo (timing attack);
// - timingSafeEqual exige buffers do mesmo tamanho;
// - SHA-256 normaliza qualquer token para 32 bytes, então a comparação é feita
//   sempre com o mesmo tamanho e em tempo constante.
//
// Isto NÃO é um sistema de autenticação de produção: não há usuários, escopos,
// expiração ou rotação de token. O objetivo é aprender o mecanismo.
// ---------------------------------------------------------------------------

const { createHash, timingSafeEqual } = require('node:crypto');
const { unauthorized } = require('../core/errors');

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function bearerAuth({ token, methods = ['POST', 'PATCH', 'DELETE'] } = {}) {
  if (typeof token !== 'string' || token.length === 0) {
    // Falha cedo: nunca subir com autenticação "vazia".
    throw new Error('bearerAuth requires a non-empty token');
  }

  const expectedDigest = digest(token);
  const protectedMethods = new Set(methods.map((method) => method.toUpperCase()));

  return async function bearerAuthMiddleware(ctx, next) {
    if (!protectedMethods.has(ctx.method)) {
      return next();
    }

    const header = ctx.headers.authorization;

    if (typeof header !== 'string') {
      throw unauthorized();
    }

    // Aceita "Bearer x", "bearer x" etc. O token em si é case-sensitive.
    const match = /^Bearer\s+(.+)$/i.exec(header);

    if (!match) {
      throw unauthorized();
    }

    const providedToken = match[1].trim();

    if (providedToken.length === 0) {
      throw unauthorized();
    }

    const providedDigest = digest(providedToken);

    if (!timingSafeEqual(providedDigest, expectedDigest)) {
      throw unauthorized();
    }

    return next();
  };
}

module.exports = { bearerAuth };
