'use strict';

// Testes do router manual: match, params, 404, 405 + Allow e encoding inválido.
// São unitários porque chamam router.resolve() sem abrir servidor.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../../src/core/router');

function handler() {
  return { status: 200, body: { ok: true } };
}

test('router matches a static route', () => {
  const router = createRouter();
  router.add('GET', '/health', handler);

  const result = router.resolve('GET', '/health');

  assert.equal(result.type, 'match');
  assert.deepEqual(result.params, {});
  assert.equal(result.handler, handler);
});

test('router matches a route with params', () => {
  const router = createRouter();
  router.add('GET', '/tasks/:id', handler);

  const result = router.resolve('GET', '/tasks/abc-123');

  assert.equal(result.type, 'match');
  assert.deepEqual(result.params, { id: 'abc-123' });
});

test('router decodes params and normalizes the trailing slash', () => {
  const router = createRouter();
  router.add('GET', '/tasks/:id', handler);

  const result = router.resolve('GET', '/tasks/hello%20world/');

  assert.equal(result.type, 'match');
  assert.deepEqual(result.params, { id: 'hello world' });
});

test('router returns not_found for an unknown path', () => {
  const router = createRouter();
  router.add('GET', '/tasks', handler);

  assert.deepEqual(router.resolve('GET', '/unknown'), {
    type: 'not_found'
  });
});

test('router returns method_not_allowed with a stable Allow list', () => {
  const router = createRouter();
  router.add('GET', '/tasks', handler);
  router.add('POST', '/tasks', handler);
  router.add('GET', '/tasks/:id', handler);
  router.add('PATCH', '/tasks/:id', handler);
  router.add('DELETE', '/tasks/:id', handler);

  assert.deepEqual(router.resolve('PUT', '/tasks'), {
    type: 'method_not_allowed',
    allowedMethods: ['GET', 'POST']
  });

  assert.deepEqual(router.resolve('POST', '/tasks/1'), {
    type: 'method_not_allowed',
    allowedMethods: ['GET', 'PATCH', 'DELETE']
  });
});

test('router throws BAD_REQUEST for invalid percent encoding', () => {
  const router = createRouter();
  router.add('GET', '/tasks/:id', handler);

  assert.throws(
    () => router.resolve('GET', '/tasks/%E0%A4%A'),
    (err) => err.code === 'BAD_REQUEST' && err.status === 400
  );
});

test('router matches the root path', () => {
  const router = createRouter();
  router.add('GET', '/', handler);

  assert.equal(router.resolve('GET', '/').type, 'match');
});
