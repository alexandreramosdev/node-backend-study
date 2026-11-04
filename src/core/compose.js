'use strict';

// ---------------------------------------------------------------------------
// src/core/compose.js
//
// Implementa o modelo "onion" de middlewares, igual ao usado por frameworks:
//
//   middleware1 -> middleware2 -> handler
//        <- next() <- next() <-
//
// Cada middleware recebe `(ctx, next)`. Ele pode:
// - chamar `await next()` e continuar o fluxo;
// - retornar um ResponseSpec sem chamar `next()` (curto-circuito, ex.: 401);
// - lançar um AppError, que o errorHandler converte em resposta.
//
// O índice `lastIndex` protege contra um middleware chamar `next()` duas vezes,
// o que executaria o restante da cadeia em duplicidade.
// ---------------------------------------------------------------------------

function compose(middlewares, handler) {
  return async function run(ctx) {
    let lastIndex = -1;

    async function dispatch(index) {
      if (index <= lastIndex) {
        throw new Error('next() called multiple times');
      }

      lastIndex = index;

      // Quando index chega ao fim dos middlewares, executamos o handler final.
      const fn = index === middlewares.length ? handler : middlewares[index];

      return fn(ctx, () => dispatch(index + 1));
    }

    return dispatch(0);
  };
}

module.exports = { compose };
