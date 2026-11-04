'use strict';

// Testes de segurança da composição da aplicação: auth fail-closed e export
// seguro do app.js raiz.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../../src/app');

test('createApp fails closed without an auth token', () => {
  assert.throws(() => createApp(), /requires config.authToken/);
  assert.throws(() => createApp({ config: {} }), /requires config.authToken/);
  assert.throws(
    () => createApp({ config: { authToken: '' } }),
    /requires config.authToken/
  );
});

test('createApp requires an explicit opt-out to disable auth', () => {
  const app = createApp({ config: { auth: false } });
  assert.equal(typeof app, 'function');
});

test('createApp accepts a configured token', () => {
  const app = createApp({ config: { authToken: 'test-token' } });
  assert.equal(typeof app, 'function');
});

test('app.js exports the factory instead of an insecure handler', () => {
  const root = require('../../app');

  assert.equal(typeof root, 'object');
  assert.equal(typeof root.createApp, 'function');
});
