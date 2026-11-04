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

function context(method, authorization, raw) {
  return {
    method,
    headers: authorization === undefined ? {} : { authorization },
    requestId: 'test-request',
    raw
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

test('bearerAuth locks out an IP after repeated failures', async () => {
  let clock = 1_000_000;
  const middleware = bearerAuth({
    token: 'secret',
    maxFailures: 3,
    windowMs: 60_000,
    now: () => clock
  });
  const raw = { socket: { remoteAddress: '10.0.0.1' } };
  const ctx = context('POST', 'Bearer wrong', raw);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assertRejectsAppError(middleware(ctx, next), {
      status: 401,
      code: 'UNAUTHORIZED'
    });
  }

  try {
    await middleware(ctx, next);
    assert.fail('expected middleware to reject');
  } catch (err) {
    assert.equal(err.status, 429);
    assert.equal(err.code, 'TOO_MANY_REQUESTS');
    assert.match(err.headers['Retry-After'], /^\d+$/);
  }

  // Depois da janela, o IP pode tentar novamente (e erra de novo -> 401).
  clock += 60_001;
  await assertRejectsAppError(middleware(ctx, next), {
    status: 401,
    code: 'UNAUTHORIZED'
  });
});

test('a successful authentication clears previous failures', async () => {
  const middleware = bearerAuth({ token: 'secret', maxFailures: 3 });
  const raw = { socket: { remoteAddress: '10.0.0.2' } };

  await assertRejectsAppError(
    middleware(context('POST', 'Bearer wrong', raw), next),
    { status: 401, code: 'UNAUTHORIZED' }
  );
  await assertRejectsAppError(
    middleware(context('POST', 'Bearer wrong', raw), next),
    { status: 401, code: 'UNAUTHORIZED' }
  );

  assert.equal(
    (await middleware(context('POST', 'Bearer secret', raw), next)).status,
    200
  );

  await assertRejectsAppError(
    middleware(context('POST', 'Bearer wrong', raw), next),
    { status: 401, code: 'UNAUTHORIZED' }
  );
});

test('one IP lockout does not block another IP', async () => {
  const middleware = bearerAuth({ token: 'secret', maxFailures: 1 });
  const blocked = { socket: { remoteAddress: '10.0.0.3' } };
  const other = { socket: { remoteAddress: '10.0.0.4' } };

  await assertRejectsAppError(
    middleware(context('POST', 'Bearer wrong', blocked), next),
    { status: 401, code: 'UNAUTHORIZED' }
  );
  await assertRejectsAppError(
    middleware(context('POST', 'Bearer wrong', blocked), next),
    { status: 429, code: 'TOO_MANY_REQUESTS' }
  );

  assert.equal(
    (await middleware(context('POST', 'Bearer secret', other), next)).status,
    200
  );
});
