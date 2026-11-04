'use strict';

// Testes do middleware Bearer: token correto/errado, esquema case-insensitive,
// métodos públicos e falha na criação com token vazio.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bearerAuth } = require('../../src/middleware/auth');
const { assertRejectsAppError } = require('../helpers/assert');

async function next() {
  return { status: 200, body: { ok: true } };
}

function context(method, authorization) {
  return {
    method,
    headers: authorization === undefined ? {} : { authorization },
    requestId: 'test-request'
  };
}

test('bearerAuth allows requests with a valid token', async () => {
  const middleware = bearerAuth({ token: 'secret' });

  const result = await middleware(context('POST', 'Bearer secret'), next);

  assert.deepEqual(result, { status: 200, body: { ok: true } });
});

test('bearerAuth accepts a case-insensitive Bearer scheme', async () => {
  const middleware = bearerAuth({ token: 'secret' });

  const result = await middleware(context('DELETE', 'bearer secret'), next);

  assert.equal(result.status, 200);
});

test('bearerAuth ignores safe methods', async () => {
  const middleware = bearerAuth({ token: 'secret' });

  assert.equal((await middleware(context('GET'), next)).status, 200);
  assert.equal((await middleware(context('GET', 'Bearer wrong'), next)).status, 200);
});

test('bearerAuth rejects missing, malformed and wrong tokens', async () => {
  const middleware = bearerAuth({ token: 'secret' });

  for (const authorization of [
    undefined,
    '',
    'secret',
    'Basic secret',
    'Bearer',
    'Bearer ',
    'Bearer wrong'
  ]) {
    await assertRejectsAppError(
      middleware(context('POST', authorization), next),
      { status: 401, code: 'UNAUTHORIZED' }
    );
  }
});

test('bearerAuth exposes a WWW-Authenticate header on failures', async () => {
  const middleware = bearerAuth({ token: 'secret' });

  try {
    await middleware(context('PATCH', 'Bearer wrong'), next);
    assert.fail('expected middleware to reject');
  } catch (err) {
    assert.equal(err.status, 401);
    assert.equal(err.headers['WWW-Authenticate'], 'Bearer realm="tasks"');
    assert.equal(err.message.includes('secret'), false);
  }
});

test('bearerAuth requires a non-empty configured token', () => {
  assert.throws(() => bearerAuth({ token: '' }), /non-empty token/);
  assert.throws(() => bearerAuth({}), /non-empty token/);
});
