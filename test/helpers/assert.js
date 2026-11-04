'use strict';

// ---------------------------------------------------------------------------
// Helper de teste: verifica se um AppError tem o status e o code esperados.
// Centraliza a asserção para os testes de domínio, auth e paginação.
// ---------------------------------------------------------------------------

const assert = require('node:assert/strict');

function assertAppError(fn, { status, code }) {
  assert.throws(fn, (err) => {
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });
}

async function assertRejectsAppError(promise, { status, code }) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });
}

module.exports = { assertAppError, assertRejectsAppError };
