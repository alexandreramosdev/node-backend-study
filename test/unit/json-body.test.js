'use strict';

// Testes da leitura do body como stream: JSON válido/inválido, corpo vazio,
// Content-Length acima do limite e corpo chunked acima do limite.
// Usamos Readable.from para simular o stream `req` sem HTTP real.

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { readJsonBody } = require('../../src/core/body');
const { assertRejectsAppError } = require('../helpers/assert');

function fakeRequest(chunks, headers = {}) {
  const req = Readable.from(chunks);
  req.headers = headers;
  return req;
}

test('readJsonBody parses a valid JSON body', async () => {
  const req = fakeRequest(['{"title":"Task"}'], {
    'content-length': '16'
  });

  assert.deepEqual(await readJsonBody(req), { title: 'Task' });
});

test('readJsonBody rejects invalid JSON', async () => {
  const req = fakeRequest(['{'], { 'content-length': '1' });

  await assertRejectsAppError(readJsonBody(req), {
    status: 400,
    code: 'INVALID_JSON'
  });
});

test('readJsonBody rejects an empty body', async () => {
  const req = fakeRequest([], { 'content-length': '0' });

  await assertRejectsAppError(readJsonBody(req), {
    status: 400,
    code: 'INVALID_JSON'
  });
});

test('readJsonBody rejects a declared length above the limit', async () => {
  const req = fakeRequest(['{}'], { 'content-length': '11' });

  await assertRejectsAppError(readJsonBody(req, { limit: 10 }), {
    status: 413,
    code: 'PAYLOAD_TOO_LARGE'
  });
});

test('readJsonBody rejects a chunked body above the limit', async () => {
  const req = fakeRequest(['123456', '789012']);

  await assertRejectsAppError(readJsonBody(req, { limit: 10 }), {
    status: 413,
    code: 'PAYLOAD_TOO_LARGE'
  });
});

test('readJsonBody rejects invalid Content-Length values', async () => {
  const req = fakeRequest(['{}'], { 'content-length': '0x10' });

  await assertRejectsAppError(readJsonBody(req), {
    status: 400,
    code: 'INVALID_JSON'
  });
});

test('readJsonBody accepts a body exactly at the limit', async () => {
  const payload = '{"a":1}';
  const req = fakeRequest([payload], {
    'content-length': String(payload.length)
  });

  assert.deepEqual(await readJsonBody(req, { limit: payload.length }), { a: 1 });
});
