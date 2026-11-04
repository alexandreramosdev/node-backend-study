'use strict';

// ---------------------------------------------------------------------------
// src/core/errors.js
//
// Erros de aplicação carregam o status HTTP e um código estável para o cliente.
// Separar `status` (HTTP) de `code` (regra de negócio) permite que o frontend
// trate casos específicos sem depender da mensagem em português/inglês.
//
// `toResponseSpec` é o ÚNICO ponto que converte exceção em resposta HTTP. Isso
// evita que stack traces, causas internas ou detalhes de implementação vazem
// para o cliente: qualquer erro desconhecido vira um 500 genérico.
// ---------------------------------------------------------------------------

class AppError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

function badRequest(message = 'Bad request') {
  return new AppError(400, 'BAD_REQUEST', message);
}

function invalidJson(message = 'Invalid JSON body') {
  return new AppError(400, 'INVALID_JSON', message);
}

function validation(message = 'Validation failed') {
  return new AppError(400, 'VALIDATION_ERROR', message);
}

function unauthorized() {
  // O header WWW-Authenticate é o padrão HTTP para desafiar autenticação.
  return new AppError(401, 'UNAUTHORIZED', 'Unauthorized', {
    'WWW-Authenticate': 'Bearer realm="tasks"'
  });
}

function notFound(message = 'Not found') {
  return new AppError(404, 'NOT_FOUND', message);
}

function methodNotAllowed(allowedMethods) {
  // O header Allow informa quais métodos existem para aquele caminho.
  return new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', {
    Allow: allowedMethods.join(', ')
  });
}

function payloadTooLarge() {
  // Connection: close evita manter uma conexão viva depois de um corpo grande.
  return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large', {
    Connection: 'close'
  });
}

function tooManyRequests(retryAfterSeconds) {
  return new AppError(429, 'TOO_MANY_REQUESTS', 'Too many requests', {
    'Retry-After': String(Math.max(1, retryAfterSeconds))
  });
}

function unsupportedMediaType() {
  return new AppError(
    415,
    'UNSUPPORTED_MEDIA_TYPE',
    'Content-Type must be application/json'
  );
}

function internal() {
  // Mensagem genérica: detalhes internos ficam apenas no log do servidor.
  return new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
}

function toResponseSpec(err) {
  // Só erros previstos (AppError) preservam status/código. Qualquer outro
  // (TypeError, erro de banco etc.) é mascarado como 500.
  const appError = err instanceof AppError ? err : internal();

  return {
    status: appError.status,
    headers: { ...appError.headers },
    body: {
      error: {
        code: appError.code,
        message: appError.message
      }
    }
  };
}

module.exports = {
  AppError,
  badRequest,
  invalidJson,
  validation,
  unauthorized,
  notFound,
  methodNotAllowed,
  payloadTooLarge,
  tooManyRequests,
  unsupportedMediaType,
  internal,
  toResponseSpec
};
