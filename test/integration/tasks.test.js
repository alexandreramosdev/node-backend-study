'use strict';

// Testes de integração do CRUD de tasks: status codes, headers, validação,
// 404/405, paginação/filtro e normalização de barra final.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/server');
const { request } = require('../helpers/request');

async function setup(t) {
  const server = await startTestServer();
  t.after(() => server.close());
  return server;
}

async function createTask(server, payload = { title: 'Task' }) {
  return request(server.baseUrl, '/tasks', {
    method: 'POST',
    body: payload
  });
}

test('GET /tasks starts with an empty paginated envelope', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    items: [],
    total: 0,
    limit: 20,
    offset: 0
  });
});

test('POST /tasks creates a task with Location and defaults', async (t) => {
  const server = await setup(t);

  const response = await createTask(server, { title: '  Estudar Node  ' });

  assert.equal(response.status, 201);
  assert.equal(response.body.title, 'Estudar Node');
  assert.equal(response.body.done, false);
  assert.match(response.body.id, /^[0-9a-f-]{36}$/);
  assert.equal(Number.isNaN(Date.parse(response.body.createdAt)), false);
  assert.equal(response.headers.get('location'), `/tasks/${response.body.id}`);
});

test('GET /tasks and GET /tasks/:id return created tasks', async (t) => {
  const server = await setup(t);
  const created = await createTask(server, { title: 'Task 1', done: true });

  const byId = await request(server.baseUrl, `/tasks/${created.body.id}`);
  const list = await request(server.baseUrl, '/tasks');

  assert.equal(byId.status, 200);
  assert.deepEqual(byId.body, created.body);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.items, [created.body]);
  assert.equal(list.body.total, 1);
});

test('GET /tasks/:id returns 404 for a missing task', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks/missing');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('POST /tasks validates the body', async (t) => {
  const server = await setup(t);

  const payloads = [
    {},
    { title: '' },
    { title: '   ' },
    { title: 10 },
    { title: 'a'.repeat(201) },
    { title: 'Task', done: 'true' },
    { title: 'Task', extra: true },
    { title: 'Task', id: 'fixed' },
    { title: 'Task', createdAt: 'fixed' },
    [],
    null
  ];

  for (const payload of payloads) {
    const response = await createTask(server, payload);

    assert.equal(
      response.status,
      400,
      `expected 400 for ${JSON.stringify(payload)}`
    );
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('POST /tasks rejects invalid and empty JSON bodies', async (t) => {
  const server = await setup(t);

  const invalid = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{'
  });

  const empty = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'INVALID_JSON');
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'INVALID_JSON');
});

test('POST /tasks requires a JSON content type', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'title=Task'
  });

  assert.equal(response.status, 415);
  assert.equal(response.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('POST /tasks accepts a JSON content type with charset', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ title: 'Task' })
  });

  assert.equal(response.status, 201);
});

test('POST /tasks rejects payloads above 1 MiB', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'x'.repeat(1024 * 1024 + 1)
  });

  assert.equal(response.status, 413);
  assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('PATCH /tasks/:id updates allowed fields', async (t) => {
  const server = await setup(t);
  const created = await createTask(server, { title: 'Before' });

  const response = await request(server.baseUrl, `/tasks/${created.body.id}`, {
    method: 'PATCH',
    body: { title: '  After  ', done: true }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.title, 'After');
  assert.equal(response.body.done, true);
  assert.equal(response.body.id, created.body.id);
  assert.equal(response.body.createdAt, created.body.createdAt);

  const fetched = await request(server.baseUrl, `/tasks/${created.body.id}`);
  assert.deepEqual(fetched.body, response.body);
});

test('PATCH /tasks/:id rejects empty and invalid bodies', async (t) => {
  const server = await setup(t);
  const created = await createTask(server);

  const empty = await request(server.baseUrl, `/tasks/${created.body.id}`, {
    method: 'PATCH',
    body: {}
  });

  const invalid = await request(server.baseUrl, `/tasks/${created.body.id}`, {
    method: 'PATCH',
    body: { done: 'yes' }
  });

  const unknown = await request(server.baseUrl, `/tasks/${created.body.id}`, {
    method: 'PATCH',
    body: { id: 'other' }
  });

  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'VALIDATION_ERROR');
  assert.equal(invalid.status, 400);
  assert.equal(unknown.status, 400);
});

test('PATCH /tasks/:id returns 404 for a missing task', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks/missing', {
    method: 'PATCH',
    body: { done: true }
  });

  assert.equal(response.status, 404);
});

test('DELETE /tasks/:id removes the task and returns 204', async (t) => {
  const server = await setup(t);
  const created = await createTask(server);

  const removed = await request(server.baseUrl, `/tasks/${created.body.id}`, {
    method: 'DELETE'
  });

  const fetched = await request(server.baseUrl, `/tasks/${created.body.id}`);

  assert.equal(removed.status, 204);
  assert.equal(removed.text, '');
  assert.equal(fetched.status, 404);
});

test('DELETE /tasks/:id returns 404 for a missing task', async (t) => {
  const server = await setup(t);

  const response = await request(server.baseUrl, '/tasks/missing', {
    method: 'DELETE'
  });

  assert.equal(response.status, 404);
});

test('unsupported methods return 405 with Allow on task routes', async (t) => {
  const server = await setup(t);

  const collection = await request(server.baseUrl, '/tasks', {
    method: 'PUT'
  });
  const item = await request(server.baseUrl, '/tasks/1', {
    method: 'POST'
  });

  assert.equal(collection.status, 405);
  assert.equal(collection.headers.get('allow'), 'GET, POST');
  assert.equal(item.status, 405);
  assert.equal(item.headers.get('allow'), 'GET, PATCH, DELETE');
});

test('trailing slashes are normalized', async (t) => {
  const server = await setup(t);

  const list = await request(server.baseUrl, '/tasks/');
  const created = await request(server.baseUrl, '/tasks/', {
    method: 'POST',
    body: { title: 'Task' }
  });

  assert.equal(list.status, 200);
  assert.equal(created.status, 201);
});

test('GET /tasks filters by done and paginates', async (t) => {
  const server = await setup(t);

  await createTask(server, { title: '1' });
  await createTask(server, { title: '2', done: true });
  await createTask(server, { title: '3' });
  await createTask(server, { title: '4', done: true });

  const done = await request(server.baseUrl, '/tasks?done=true');
  const page = await request(server.baseUrl, '/tasks?limit=2&offset=1');

  assert.equal(done.status, 200);
  assert.deepEqual(done.body.items.map((task) => task.title), ['2', '4']);
  assert.equal(done.body.total, 2);

  assert.equal(page.status, 200);
  assert.deepEqual(page.body.items.map((task) => task.title), ['2', '3']);
  assert.equal(page.body.total, 4);
  assert.equal(page.body.limit, 2);
  assert.equal(page.body.offset, 1);
});

test('GET /tasks validates query parameters', async (t) => {
  const server = await setup(t);

  for (const query of ['done=yes', 'limit=0', 'limit=101', 'offset=-1']) {
    const response = await request(server.baseUrl, `/tasks?${query}`);

    assert.equal(response.status, 400, `expected 400 for ${query}`);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});
