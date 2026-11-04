'use strict';

// Testes do repositório de arquivo: carga, persistência entre instâncias,
// escrita atômica, concorrência, envelope versionado e arquivo corrompido.
// Cada teste usa um diretório temporário isolado.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  createFileRepository,
  VERSION
} = require('../../src/repositories/file');

function task(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    done: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

async function tempFilePath(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tasks-repo-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return path.join(directory, 'tasks.json');
}

test('file repository starts empty when the file does not exist', async (t) => {
  const filePath = await tempFilePath(t);
  const repository = await createFileRepository({ filePath });

  assert.deepEqual(await repository.list(), { items: [], total: 0 });
});

test('file repository persists created tasks', async (t) => {
  const filePath = await tempFilePath(t);
  const repository = await createFileRepository({ filePath });

  await repository.create(task('1'));

  const reloaded = await createFileRepository({ filePath });

  assert.deepEqual(await reloaded.findById('1'), task('1'));
  assert.deepEqual(await reloaded.list(), { items: [task('1')], total: 1 });
});

test('file repository persists updates and removals', async (t) => {
  const filePath = await tempFilePath(t);
  const repository = await createFileRepository({ filePath });

  await repository.create(task('1'));
  await repository.create(task('2'));
  await repository.update('1', { title: 'Updated' });
  await repository.remove('2');

  const reloaded = await createFileRepository({ filePath });

  assert.deepEqual(await reloaded.findById('1'), task('1', { title: 'Updated' }));
  assert.equal(await reloaded.findById('2'), null);
});

test('file repository serializes concurrent writes', async (t) => {
  const filePath = await tempFilePath(t);
  const repository = await createFileRepository({ filePath });

  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      repository.create(task(String(index)))
    )
  );

  const reloaded = await createFileRepository({ filePath });
  const { items, total } = await reloaded.list();

  assert.equal(total, 20);
  assert.equal(items.length, 20);
});

test('file repository leaves no temporary files behind', async (t) => {
  const filePath = await tempFilePath(t);
  const repository = await createFileRepository({ filePath });

  await repository.create(task('1'));
  await repository.update('1', { done: true });

  const files = await readdir(path.dirname(filePath));

  assert.deepEqual(files, ['tasks.json']);
});

test('file repository filters and paginates', async (t) => {
  const filePath = await tempFilePath(t);
  const repository = await createFileRepository({ filePath });

  await repository.create(task('1'));
  await repository.create(task('2', { done: true }));
  await repository.create(task('3'));
  await repository.create(task('4', { done: true }));

  const page = await repository.list({ done: true, limit: 1, offset: 1 });

  assert.deepEqual(page.items.map((item) => item.id), ['4']);
  assert.equal(page.total, 2);
});

test('file repository rejects corrupt JSON files', async (t) => {
  const filePath = await tempFilePath(t);
  await writeFile(filePath, '{ not json', 'utf8');

  await assert.rejects(
    createFileRepository({ filePath }),
    /contains invalid JSON/
  );
});

test('file repository rejects invalid envelopes', async (t) => {
  const filePath = await tempFilePath(t);
  await writeFile(filePath, JSON.stringify({ version: 99, tasks: [] }), 'utf8');

  await assert.rejects(
    createFileRepository({ filePath }),
    /invalid envelope/
  );
});

test('file repository rejects duplicate task ids', async (t) => {
  const filePath = await tempFilePath(t);
  await writeFile(
    filePath,
    JSON.stringify({
      version: VERSION,
      tasks: [task('1'), task('1')]
    }),
    'utf8'
  );

  await assert.rejects(
    createFileRepository({ filePath }),
    /duplicate task id/
  );
});

test('file repository writes the versioned envelope', async (t) => {
  const filePath = await tempFilePath(t);
  const repository = await createFileRepository({ filePath });

  await repository.create(task('1'));

  const parsed = JSON.parse(await readFile(filePath, 'utf8'));

  assert.deepEqual(parsed, {
    version: VERSION,
    tasks: [task('1')]
  });
});
