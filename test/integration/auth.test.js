'use strict';

// Testes de integração de autenticação: rotas públicas, 401 nas escritas,
// precedência de 404/405 sobre auth e auth antes do body parser.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/server');
const { request } = require('../helpers/request');

async function setup(t) {
  const server = await startTestServer({ config: { authToken: 'secret' } });
  t.after(() => server.close());
  return server;
}

test('public routes do not require a token', async (t) => {
  const server = await setup(t);

  const root = await request(server.baseUrl, '/');
  const health = await request(server.baseUrl, '/health');
  const tasks = await request(server.baseUrl, '/tasks');

  assert.equal(root.status, 200);
  assert.equal(health.status, 200);
  assert.equal(tasks.status, 200);
});

test('write routes reject missing tokens with 401', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    body: { title: 'Task' }
  });

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('www-authenticate'), 'Bearer realm="tasks"');
  assert.deepEqual(response.body, {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Unauthorized'
    }
  });
});

test('write routes reject wrong tokens', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    token: 'wrong',
    body: { title: 'Task' }
  });

  assert.equal(response.status, 401);
  assert.equal(response.text.includes('secret'), false);
});

test('write routes accept the configured token', async (t) => {
  const server = await setup(t);

  const created = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    token: 'secret',
    body: { title: 'Task' }
  });

  const patched = await request(server.baseUrl, `/tasks/${created.body.id}`, {
    method: 'PATCH',
    token: 'secret',
    body: { done: true }
  });

  const removed = await request(server.baseUrl, `/tasks/${created.body.id}`, {
    method: 'DELETE',
    token: 'secret'
  });

  assert.equal(created.status, 201);
  assert.equal(patched.status, 200);
  assert.equal(removed.status, 204);
});

test('the Bearer scheme is case-insensitive', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    headers: { Authorization: 'bearer secret' },
    body: { title: 'Task' }
  });

  assert.equal(response.status, 201);
});

test('routing errors happen before authentication', async (t) => {
  const server = await setup(t);

  const unknown = await request(server.baseUrl, '/unknown', {
    method: 'POST',
    body: { title: 'Task' }
  });
  const wrongMethod = await request(server.baseUrl, '/tasks', {
    method: 'PUT'
  });

  assert.equal(unknown.status, 404);
  assert.equal(wrongMethod.status, 405);
});

test('authentication fails before body parsing', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'not json'
  });

  assert.equal(response.status, 401);
});
