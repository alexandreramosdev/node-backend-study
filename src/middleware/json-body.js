'use strict';

// ---------------------------------------------------------------------------
// src/middleware/json-body.js
//
// Faz a "negociação de conteúdo" do body:
// - só lê corpo em POST/PATCH (GET/DELETE ignoram);
// - exige Content-Type application/json (com ou sem charset);
// - se o tipo estiver errado, responde 415 antes de ler o stream;
// - delega a leitura/limite/parse para core/body.js;
// - disponibiliza o resultado em `ctx.body` para a rota.
//
// A ordem importa: este middleware roda DEPOIS do auth, então um request sem
// token não tem o corpo processado.
// ---------------------------------------------------------------------------

const { readJsonBody, DEFAULT_LIMIT } = require('../core/body');
const { unsupportedMediaType } = require('../core/errors');

function isJsonContentType(value) {
  if (typeof value !== 'string') {
    return false;
  }

  // "application/json; charset=utf-8" -> "application/json"
  return value.split(';')[0].trim().toLowerCase() === 'application/json';
}

function jsonBody({ limit = DEFAULT_LIMIT } = {}) {
  return async function jsonBodyMiddleware(ctx, next) {
    if (ctx.method !== 'POST' && ctx.method !== 'PATCH') {
      return next();
    }

    if (!isJsonContentType(ctx.headers['content-type'])) {
      throw unsupportedMediaType();
    }

    ctx.body = await readJsonBody(ctx.raw, { limit });

    return next();
  };
}

module.exports = { jsonBody, isJsonContentType };
