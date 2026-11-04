'use strict';

// ---------------------------------------------------------------------------
// src/core/router.js
//
// Router manual, sem framework. Cada rota é registrada como
// (método, padrão de path, handler), e o padrão pode conter `:nome` para
// capturar um segmento:
//
//   router.add('GET', '/tasks/:id', handler)
//   resolve('GET', '/tasks/42') -> { type: 'match', params: { id: '42' } }
//
// Resolver primeiro o PATH e depois o MÉTODO é o que permite diferenciar:
//   404 NOT_FOUND        -> nenhuma rota tem esse caminho
//   405 METHOD_NOT_ALLOWED -> o caminho existe, mas não com esse método
// No caso 405, `allowedMethods` vira o header Allow.
// ---------------------------------------------------------------------------

const { badRequest } = require('./errors');

function splitPath(pathname) {
  // '/' vira [] e '/tasks/1' vira ['tasks', '1']. Segmentos vazios são
  // ignorados, então barras duplicadas/finais não quebram o matching.
  if (!pathname || pathname === '/') {
    return [];
  }

  return pathname.split('/').filter((segment) => segment.length > 0);
}

function decodeSegments(pathname) {
  try {
    // decodeURIComponent pode lançar com percent-encoding inválido
    // (ex.: "%E0%A4%A"). Convertemos isso em 400, não em 500.
    return splitPath(pathname).map((segment) => decodeURIComponent(segment));
  } catch {
    throw badRequest('Invalid URL encoding');
  }
}

function matchSegments(patternSegments, requestedSegments) {
  if (patternSegments.length !== requestedSegments.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const pattern = patternSegments[index];
    const value = requestedSegments[index];

    if (pattern.startsWith(':')) {
      // `:id` captura exatamente um segmento não vazio.
      if (!value) {
        return null;
      }

      params[pattern.slice(1)] = value;
      continue;
    }

    if (pattern !== value) {
      return null;
    }
  }

  // Objeto vazio também é "truthy", então {} significa match sem params.
  return params;
}

function createRouter() {
  const routes = [];

  const router = {
    add(method, pattern, handler) {
      routes.push({
        method: method.toUpperCase(),
        segments: splitPath(pattern),
        handler
      });

      return router;
    },

    resolve(method, pathname) {
      const requestedSegments = decodeSegments(pathname);
      const normalizedMethod = method.toUpperCase();
      const allowedMethods = [];

      // Percorremos todas as rotas cujo PATH casa, mesmo que o método não
      // case, para montar o Allow. A ordem de registro é preservada.
      for (const route of routes) {
        const params = matchSegments(route.segments, requestedSegments);

        if (!params) {
          continue;
        }

        if (!allowedMethods.includes(route.method)) {
          allowedMethods.push(route.method);
        }

        if (route.method === normalizedMethod) {
          return {
            type: 'match',
            handler: route.handler,
            params
          };
        }
      }

      if (allowedMethods.length > 0) {
        return { type: 'method_not_allowed', allowedMethods };
      }

      return { type: 'not_found' };
    }
  };

  return router;
}

module.exports = { createRouter, splitPath };
