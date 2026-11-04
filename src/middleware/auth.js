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
const { unauthorized, tooManyRequests } = require('../core/errors');

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function clientKey(ctx) {
  return ctx.raw && ctx.raw.socket && ctx.raw.socket.remoteAddress
    ? ctx.raw.socket.remoteAddress
    : 'unknown';
}

function bearerAuth({
  token,
  methods = ['POST', 'PATCH', 'DELETE'],
  maxFailures = 10,
  windowMs = 60_000,
  now = Date.now
} = {}) {
  if (typeof token !== 'string' || token.length === 0) {
    // Falha cedo: nunca subir com autenticação "vazia".
    throw new Error('bearerAuth requires a non-empty token');
  }

  const expectedDigest = digest(token);
  const protectedMethods = new Set(methods.map((method) => method.toUpperCase()));

  // Rate limit/lockout em memória por IP. É simples de propósito: em um
  // processo único e didático, evita brute force trivial. Em produção, isso
  // deve ser distribuído (Redis, proxy/WAF) e com métricas.
  const attempts = new Map();

  function getAttemptState(key) {
    const state = attempts.get(key);

    if (!state) {
      return null;
    }

    const current = now();

    if (state.blockedUntil > current) {
      return state;
    }

    if (current - state.firstAt > windowMs) {
      attempts.delete(key);
      return null;
    }

    return state;
  }

  function registerFailure(key) {
    const current = now();
    const state = getAttemptState(key);

    if (!state) {
      const entry = { count: 1, firstAt: current, blockedUntil: 0 };

      if (entry.count >= maxFailures) {
        entry.blockedUntil = current + windowMs;
      }

      attempts.set(key, entry);
      return;
    }

    state.count += 1;

    if (state.count >= maxFailures) {
      state.blockedUntil = current + windowMs;
    }
  }

  return async function bearerAuthMiddleware(ctx, next) {
    if (!protectedMethods.has(ctx.method)) {
      return next();
    }

    const key = clientKey(ctx);
    const state = getAttemptState(key);

    if (state && state.blockedUntil > now()) {
      const retryAfter = Math.ceil((state.blockedUntil - now()) / 1000);
      throw tooManyRequests(retryAfter);
    }

    const header = ctx.headers.authorization;

    if (typeof header !== 'string') {
      registerFailure(key);
      throw unauthorized();
    }

    // Aceita "Bearer x", "bearer x" etc. O token em si é case-sensitive.
    const match = /^Bearer\s+(.+)$/i.exec(header);

    if (!match) {
      registerFailure(key);
      throw unauthorized();
    }

    const providedToken = match[1].trim();

    if (providedToken.length === 0) {
      registerFailure(key);
      throw unauthorized();
    }

    const providedDigest = digest(providedToken);

    if (!timingSafeEqual(providedDigest, expectedDigest)) {
      registerFailure(key);
      throw unauthorized();
    }

    // Login bem-sucedido zera o histórico daquele IP.
    attempts.delete(key);
    return next();
  };
}

module.exports = { bearerAuth };
