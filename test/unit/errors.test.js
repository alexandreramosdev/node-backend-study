'use strict';

// Testes da conversão de erros para o contrato HTTP: shape, headers e
// garantia de que erros desconhecidos não vazam stack/detalhes.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AppError,
  notFound,
  methodNotAllowed,
  unauthorized,
  toResponseSpec
} = require('../../src/core/errors');

test('toResponseSpec converts an AppError into the standard error body', () => {
  const spec = toResponseSpec(methodNotAllowed(['GET', 'POST']));

  assert.equal(spec.status, 405);
  assert.equal(spec.headers.Allow, 'GET, POST');
  assert.deepEqual(spec.body, {
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed'
    }
  });
});

test('toResponseSpec keeps authentication headers', () => {
  const spec = toResponseSpec(unauthorized());

  assert.equal(spec.status, 401);
  assert.equal(spec.headers['WWW-Authenticate'], 'Bearer realm="tasks"');
});

test('toResponseSpec hides internal errors from unknown exceptions', () => {
  const spec = toResponseSpec(new Error('database password leaked'));

  assert.equal(spec.status, 500);
  assert.deepEqual(spec.body, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
  assert.equal(JSON.stringify(spec.body).includes('password'), false);
});

test('toResponseSpec preserves not found responses', () => {
  const spec = toResponseSpec(notFound('Task not found'));

  assert.equal(spec.status, 404);
  assert.equal(spec.body.error.code, 'NOT_FOUND');
});

test('AppError exposes status, code and headers', () => {
  const error = new AppError(418, 'TEAPOT', 'Short and stout', {
    'X-Test': '1'
  });

  assert.equal(error.status, 418);
  assert.equal(error.code, 'TEAPOT');
  assert.equal(error.headers['X-Test'], '1');
});
