'use strict';

// ---------------------------------------------------------------------------
// src/core/response.js
//
// Handlers e middlewares NÃO escrevem em `res`. Eles retornam um ResponseSpec:
//
//   { status: 200, headers: {}, body: { ... } }
//
// Vantagens didáticas:
// - o fluxo de resposta fica explícito e testável (é só um objeto);
// - o envio real acontece em um único lugar;
// - evita "headers already sent" espalhado pelo código.
//
// `body: undefined` significa sem corpo (ex.: 204 No Content).
// ---------------------------------------------------------------------------

function json(status, body, headers = {}) {
  return { status, headers, body };
}

function empty(status, headers = {}) {
  return { status, headers, body: undefined };
}

function sendResponse(res, spec) {
  if (!spec) {
    throw new Error('Handler did not return a response');
  }

  // Guarda contra resposta dupla: se algo já começou a escrever, não tentamos
  // escrever de novo (evita ERR_HTTP_HEADERS_SENT).
  if (res.headersSent || res.writableEnded || res.destroyed) {
    return;
  }

  const headers = { ...(spec.headers || {}) };

  if (spec.body === undefined) {
    // 204: sem Content-Type e sem corpo.
    res.writeHead(spec.status, headers);
    res.end();
    return;
  }

  // Content-Length deve ser a quantidade de BYTES em UTF-8, não a quantidade
  // de caracteres. Buffer.byteLength faz essa conta corretamente.
  const payload = JSON.stringify(spec.body);
  headers['Content-Type'] =
    headers['Content-Type'] || 'application/json; charset=utf-8';
  headers['Content-Length'] = Buffer.byteLength(payload);

  res.writeHead(spec.status, headers);
  res.end(payload);
}

module.exports = { json, empty, sendResponse };
