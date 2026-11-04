'use strict';

// Testes da validação de query string de GET /tasks: done, limit e offset.

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseListQuery } = require('../../src/routes/tasks');

function query(input) {
  return new URLSearchParams(input);
}

test('parseListQuery applies pagination defaults', () => {
  assert.deepEqual(parseListQuery(query('')), {
    done: undefined,
    limit: 20,
    offset: 0
  });
});

test('parseListQuery parses done, limit and offset', () => {
  assert.deepEqual(parseListQuery(query('done=true&limit=5&offset=10')), {
    done: true,
    limit: 5,
    offset: 10
  });

  assert.deepEqual(parseListQuery(query('done=false')), {
    done: false,
    limit: 20,
    offset: 0
  });
});

test('parseListQuery ignores unknown parameters', () => {
  assert.deepEqual(parseListQuery(query('unknown=value')), {
    done: undefined,
    limit: 20,
    offset: 0
  });
});

test('parseListQuery rejects invalid values', () => {
  for (const input of [
    'done=yes',
    'limit=0',
    'limit=101',
    'limit=-1',
    'limit=abc',
    'offset=-1',
    'offset=abc',
    'offset=1.5'
  ]) {
    assert.throws(
      () => parseListQuery(query(input)),
      (err) => err.code === 'VALIDATION_ERROR' && err.status === 400,
      `expected ${input} to fail`
    );
  }
});

test('parseListQuery enforces the maximum limit', () => {
  assert.equal(parseListQuery(query('limit=100')).limit, 100);
  assert.throws(() => parseListQuery(query('limit=101')), /between 1 and 100/);
});
