'use strict';

// ---------------------------------------------------------------------------
// Helper de teste: faz uma requisição com fetch e devolve status, headers,
// texto e JSON já parseado (quando aplicável).
//
// Regras didáticas:
// - objeto em `body` vira JSON e ganha Content-Type automaticamente;
// - string/Buffer é enviado cru (o fetch define text/plain se não houver header),
//   o que permite testar 415 e JSON inválido;
// - `token` adiciona o header Authorization: Bearer.
// ---------------------------------------------------------------------------

function hasHeader(headers, name) {
  return Object.keys(headers).some(
    (key) => key.toLowerCase() === name.toLowerCase()
  );
}

async function request(baseUrl, path, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    token,
    redirect = 'manual'
  } = options;

  const finalHeaders = { ...headers };
  const init = { method, headers: finalHeaders, redirect };

  if (token !== undefined) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);

      if (!hasHeader(finalHeaders, 'content-type')) {
        finalHeaders['Content-Type'] = 'application/json';
      }
    }
  }

  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();

  let parsedBody;

  try {
    parsedBody = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    parsedBody = undefined;
  }

  return {
    status: response.status,
    headers: response.headers,
    text,
    body: parsedBody
  };
}

module.exports = { request };
