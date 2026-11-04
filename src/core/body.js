'use strict';

// ---------------------------------------------------------------------------
// src/core/body.js
//
// Lê o corpo da requisição como stream, acumula os chunks e faz JSON.parse.
//
// Por que não `JSON.parse(req.body)`? No Node nativo `req` é um stream; não
// existe `req.body` pronto (isso é algo que frameworks adicionam).
//
// O limite de 1 MiB é uma proteção simples contra payloads gigantes:
// - se Content-Length já declarar algo maior, rejeitamos antes de ler;
// - se o corpo vier chunked (sem Content-Length), contamos os bytes durante a
//   leitura e interrompemos ao ultrapassar o limite.
//
// `req.resume()` é usado para drenar o restante da requisição depois de um
// erro, evitando que a conexão fique presa.
// ---------------------------------------------------------------------------

const { badRequest, invalidJson, payloadTooLarge } = require('./errors');

const DEFAULT_LIMIT = 1024 * 1024;

function readJsonBody(req, { limit = DEFAULT_LIMIT } = {}) {
  return new Promise((resolve, reject) => {
    const contentLength = req.headers['content-length'];

    // Caminho rápido: Content-Length confiável permite rejeitar sem ler.
    if (contentLength !== undefined) {
      if (!/^\d+$/.test(contentLength)) {
        req.resume();
        reject(invalidJson('Invalid Content-Length'));
        return;
      }

      const declaredLength = Number(contentLength);

      if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
        req.resume();
        reject(invalidJson('Invalid Content-Length'));
        return;
      }

      if (declaredLength > limit) {
        req.resume();
        reject(payloadTooLarge());
        return;
      }
    }

    const chunks = [];
    let size = 0;
    let finished = false;

    // Remove os listeners ao terminar/falhar para não vazar memória.
    function cleanup() {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('aborted', onAborted);
    }

    function fail(err) {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      reject(err);
    }

    function onData(chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;

      if (size > limit) {
        fail(payloadTooLarge());
        req.resume(); // descarta o resto sem processar
        return;
      }

      chunks.push(buffer);
    }

    function onEnd() {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();

      const text = Buffer.concat(chunks).toString('utf8');

      // Corpo vazio não é JSON válido para nossos endpoints.
      if (text.trim().length === 0) {
        reject(invalidJson('Request body is empty'));
        return;
      }

      try {
        resolve(JSON.parse(text));
      } catch {
        reject(invalidJson('Request body is not valid JSON'));
      }
    }

    function onError() {
      fail(badRequest('Could not read request body'));
    }

    function onAborted() {
      fail(badRequest('Request aborted'));
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAborted);
  });
}

module.exports = { readJsonBody, DEFAULT_LIMIT };
