'use strict';

// Testes das regras de domínio: validação de create/patch e criação de Task
// com relógio e uuid injetados (sem depender de data real).

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCreate,
  validatePatch,
  validateTitle,
  validateDone,
  buildTask
} = require('../../src/domain/tasks');
const { assertAppError } = require('../helpers/assert');

function expectValidation(fn, messagePart) {
  assertAppError(fn, { status: 400, code: 'VALIDATION_ERROR' });

  if (messagePart) {
    assert.throws(fn, (err) => err.message.includes(messagePart));
  }
}

test('validateCreate trims the title and defaults done to false', () => {
  assert.deepEqual(validateCreate({ title: '  Estudar Node  ' }), {
    title: 'Estudar Node',
    done: false
  });
});

test('validateCreate accepts done explicitly', () => {
  assert.deepEqual(validateCreate({ title: 'Task', done: true }), {
    title: 'Task',
    done: true
  });
});

test('validateCreate rejects invalid payloads', () => {
  expectValidation(() => validateCreate(null));
  expectValidation(() => validateCreate([]));
  expectValidation(() => validateCreate('task'));
  expectValidation(() => validateCreate({}), 'title');
  expectValidation(() => validateCreate({ title: '' }), 'title');
  expectValidation(() => validateCreate({ title: '   ' }), 'title');
  expectValidation(() => validateCreate({ title: 10 }), 'title');
  expectValidation(() => validateCreate({ title: 'a'.repeat(201) }), '200');
  expectValidation(() => validateCreate({ title: 'Task', done: 'true' }), 'done');
});

test('validateCreate rejects unknown fields, including immutable ones', () => {
  expectValidation(() => validateCreate({ title: 'Task', extra: true }), 'extra');
  expectValidation(() => validateCreate({ title: 'Task', id: 'x' }), 'id');
  expectValidation(
    () => validateCreate({ title: 'Task', createdAt: 'x' }),
    'createdAt'
  );
});

test('validatePatch accepts partial updates', () => {
  assert.deepEqual(validatePatch({ title: '  Novo  ' }), { title: 'Novo' });
  assert.deepEqual(validatePatch({ done: true }), { done: true });
  assert.deepEqual(validatePatch({ title: 'Novo', done: false }), {
    title: 'Novo',
    done: false
  });
});

test('validatePatch requires at least one field', () => {
  expectValidation(() => validatePatch({}), 'At least one');
});

test('validatePatch rejects unknown and invalid fields', () => {
  expectValidation(() => validatePatch({ done: 'yes' }), 'done');
  expectValidation(() => validatePatch({ title: '' }), 'title');
  expectValidation(() => validatePatch({ id: 'x' }), 'id');
  expectValidation(() => validatePatch({ createdAt: 'x' }), 'createdAt');
});

test('validateTitle and validateDone expose focused validation', () => {
  assert.equal(validateTitle('  ok  '), 'ok');
  assert.equal(validateDone(false), false);
  expectValidation(() => validateTitle(undefined));
  expectValidation(() => validateDone(0));
});

test('buildTask uses injected clock and uuid', () => {
  const task = buildTask(
    { title: 'Task', done: false },
    {
      now: () => new Date('2026-02-03T04:05:06.000Z'),
      uuid: () => 'fixed-id'
    }
  );

  assert.deepEqual(task, {
    id: 'fixed-id',
    title: 'Task',
    done: false,
    createdAt: '2026-02-03T04:05:06.000Z'
  });
});
