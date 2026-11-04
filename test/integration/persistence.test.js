'use strict';

// Testes de integração da persistência: cria/atualiza/remove via HTTP, fecha o
// servidor/repositório, recarrega o mesmo arquivo e confere os dados.

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createFileRepository } = require('../../src/repositories/file');
const { startTestServer } = require('../helpers/server');
const { request } = require('../helpers/request');

test('tasks survive a repository reload', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tasks-http-'));
  const filePath = path.join(directory, 'tasks.json');

  t.after(() => rm(directory, { recursive: true, force: true }));

  const firstRepository = await createFileRepository({ filePath });
  const firstServer = await startTestServer({ repository: firstRepository });

  let created;

  try {
    created = await request(firstServer.baseUrl, '/tasks', {
      method: 'POST',
      body: { title: 'Persistir', done: false }
    });
  } finally {
    await firstServer.close();
  }

  const secondRepository = await createFileRepository({ filePath });
  const secondServer = await startTestServer({ repository: secondRepository });
  t.after(() => secondServer.close());

  const list = await request(secondServer.baseUrl, '/tasks');
  const byId = await request(secondServer.baseUrl, `/tasks/${created.body.id}`);

  assert.equal(created.status, 201);
  assert.deepEqual(list.body.items, [created.body]);
  assert.deepEqual(byId.body, created.body);
});

test('updates and deletions survive a repository reload', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tasks-http-'));
  const filePath = path.join(directory, 'tasks.json');

  t.after(() => rm(directory, { recursive: true, force: true }));

  const firstRepository = await createFileRepository({ filePath });
  const firstServer = await startTestServer({ repository: firstRepository });

  const first = await request(firstServer.baseUrl, '/tasks', {
    method: 'POST',
    body: { title: 'Fica' }
  });
  const second = await request(firstServer.baseUrl, '/tasks', {
    method: 'POST',
    body: { title: 'Sai' }
  });

  await request(firstServer.baseUrl, `/tasks/${first.body.id}`, {
    method: 'PATCH',
    body: { done: true }
  });
  await request(firstServer.baseUrl, `/tasks/${second.body.id}`, {
    method: 'DELETE'
  });

  await firstServer.close();

  const secondRepository = await createFileRepository({ filePath });
  const secondServer = await startTestServer({ repository: secondRepository });
  t.after(() => secondServer.close());

  const list = await request(secondServer.baseUrl, '/tasks');

  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].title, 'Fica');
  assert.equal(list.body.items[0].done, true);
});
