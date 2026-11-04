'use strict';

// Testes do repositório em memória: CRUD, filtro/paginação, imutabilidade dos
// campos id/createdAt e isolamento das referências devolvidas.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('../../src/repositories/memory');

function task(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    done: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

test('memory repository starts empty', async () => {
  const repository = createMemoryRepository();

  assert.deepEqual(await repository.list(), { items: [], total: 0 });
});

test('memory repository creates and finds tasks', async () => {
  const repository = createMemoryRepository();
  const created = await repository.create(task('1'));

  assert.deepEqual(created, task('1'));
  assert.deepEqual(await repository.findById('1'), task('1'));
  assert.equal(await repository.findById('missing'), null);
});

test('memory repository updates tasks and preserves immutable fields', async () => {
  const repository = createMemoryRepository();
  await repository.create(task('1'));

  const updated = await repository.update('1', {
    title: 'Updated',
    id: 'other',
    createdAt: 'other'
  });

  assert.deepEqual(updated, task('1', { title: 'Updated' }));
  assert.equal(await repository.update('missing', { title: 'x' }), null);
});

test('memory repository removes tasks', async () => {
  const repository = createMemoryRepository();
  await repository.create(task('1'));

  assert.equal(await repository.remove('1'), true);
  assert.equal(await repository.remove('1'), false);
  assert.equal(await repository.findById('1'), null);
});

test('memory repository filters by done and paginates', async () => {
  const repository = createMemoryRepository();

  await repository.create(task('1'));
  await repository.create(task('2', { done: true }));
  await repository.create(task('3'));
  await repository.create(task('4', { done: true }));

  const done = await repository.list({ done: true });
  assert.deepEqual(done.items.map((item) => item.id), ['2', '4']);
  assert.equal(done.total, 2);

  const page = await repository.list({ limit: 2, offset: 1 });
  assert.deepEqual(page.items.map((item) => item.id), ['2', '3']);
  assert.equal(page.total, 4);
});

test('memory repository returns copies instead of internal references', async () => {
  const repository = createMemoryRepository();
  const created = await repository.create(task('1'));

  created.title = 'mutated';

  assert.equal((await repository.findById('1')).title, 'Task 1');
});

test('memory repository seeds initial data', async () => {
  const repository = createMemoryRepository({ seed: [task('1')] });

  assert.deepEqual((await repository.list()).items, [task('1')]);
});
