'use strict';

// ---------------------------------------------------------------------------
// src/core/request.js
//
// Converte o objeto cru do Node (`req`) em um contexto mais simples para os
// handlers. `new URL` separa path, query e encoding corretamente; usamos uma
// base fictícia porque o Node entrega apenas o caminho (ex.: "/tasks?x=1").
//
// O `req` original fica em `raw` para que o body parser possa ler o stream.
// ---------------------------------------------------------------------------

const { URL } = require('node:url');
const { badRequest } = require('./errors');

const BASE_URL = 'http://localhost';

function normalizePathname(pathname) {
  // Trata "/", "/tasks/" e "tasks" de forma equivalente.
  if (!pathname || pathname === '/') {
    return '/';
  }

  const value = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const withoutTrailingSlash = value.replace(/\/+$/, '');

  return withoutTrailingSlash || '/';
}

function parseRequest(req) {
  let url;

  try {
    url = new URL(req.url || '/', BASE_URL);
  } catch {
    // Algumas URLs malformadas fazem o construtor lançar.
    throw badRequest('Invalid request URL');
  }

  return {
    method: (req.method || 'GET').toUpperCase(),
    pathname: normalizePathname(url.pathname),
    query: url.searchParams, // URLSearchParams: get/has com decoding pronto
    headers: req.headers, // Node já entrega as chaves em minúsculas
    raw: req
  };
}

module.exports = { parseRequest, normalizePathname };
