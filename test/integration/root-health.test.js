'use strict';

// Testes de integração das rotas de sistema e do tratamento global de erros.
// O servidor real sobe na porta 0; fetch faz as requisições.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/server');
const { request } = require('../helpers/request');

test('GET / returns the hello message', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await request(server.baseUrl, '/');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { message: 'Hello World' });
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.ok(response.headers.get('x-request-id'));
});

test('GET /health returns the health status', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await request(server.baseUrl, '/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('unknown routes return the standard 404 error', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await request(server.baseUrl, '/unknown');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: {
      code: 'NOT_FOUND',
      message: 'Not found'
    }
  });
});

test('known routes with an unsupported method return 405 with Allow', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await request(server.baseUrl, '/', { method: 'POST' });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(response.body.error.code, 'METHOD_NOT_ALLOWED');
});

test('unexpected errors return a safe 500 response', async (t) => {
  const failingRepository = {
    async list() {
      throw new Error('database password leaked');
    }
  };

  const server = await startTestServer({ repository: failingRepository });
  t.after(() => server.close());

  const response = await request(server.baseUrl, '/tasks');

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
  assert.equal(response.text.includes('password'), false);
  assert.equal(response.text.includes('stack'), false);
});
