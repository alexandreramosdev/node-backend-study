'use strict';

// Testes de configuração: defaults, overrides, host local, porta 0, política de
// token, restrição do DATA_FILE e erros agregados.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadConfig, ConfigError } = require('../../src/config');

const VALID_TOKEN = 'test-token-0123456789';

test('loadConfig applies secure defaults', () => {
  const config = loadConfig({ AUTH_TOKEN: VALID_TOKEN });

  assert.equal(config.port, 3000);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.logLevel, 'info');
  assert.equal(config.authToken, VALID_TOKEN);
  assert.equal(
    config.dataFile,
    path.resolve(process.cwd(), './data/tasks.json')
  );
});

test('loadConfig accepts valid overrides', () => {
  const config = loadConfig({
    HOST: '0.0.0.0',
    PORT: '8080',
    DATA_FILE: './data/custom.json',
    LOG_LEVEL: 'DEBUG',
    AUTH_TOKEN: `  ${VALID_TOKEN}  `
  });

  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 8080);
  assert.equal(config.logLevel, 'debug');
  assert.equal(config.authToken, VALID_TOKEN);
  assert.equal(
    config.dataFile,
    path.resolve(process.cwd(), './data/custom.json')
  );
});

test('loadConfig accepts port 0', () => {
  const config = loadConfig({ AUTH_TOKEN: VALID_TOKEN, PORT: '0' });
  assert.equal(config.port, 0);
});

test('loadConfig requires AUTH_TOKEN', () => {
  assert.throws(() => loadConfig({}), ConfigError);
  assert.throws(
    () => loadConfig({}),
    (err) => err.message.includes('AUTH_TOKEN is required')
  );
  assert.throws(
    () => loadConfig({ AUTH_TOKEN: '   ' }),
    (err) => err.message.includes('AUTH_TOKEN must be a non-empty string')
  );
});

test('loadConfig rejects short and weak tokens', () => {
  assert.throws(
    () => loadConfig({ AUTH_TOKEN: 'short' }),
    (err) => err.message.includes('at least 16 characters')
  );

  for (const token of ['dev-secret', 'secret', 'changeme', 'password']) {
    assert.throws(
      () => loadConfig({ AUTH_TOKEN: `${token}-padding-123456` }),
      (err) => err.message.includes('common/weak value'),
      `expected ${token} to be rejected`
    );
  }
});

test('loadConfig rejects invalid hosts', () => {
  assert.throws(
    () => loadConfig({ AUTH_TOKEN: VALID_TOKEN, HOST: '   ' }),
    (err) => err.message.includes('HOST must be a non-empty string')
  );
});

test('loadConfig rejects invalid ports', () => {
  for (const value of ['abc', '1.5', '-1', '70000', '', '3000abc']) {
    assert.throws(
      () => loadConfig({ AUTH_TOKEN: VALID_TOKEN, PORT: value }),
      (err) =>
        err instanceof ConfigError &&
        err.message.includes('PORT must be an integer'),
      `expected PORT=${JSON.stringify(value)} to fail`
    );
  }
});

test('loadConfig rejects invalid log levels', () => {
  assert.throws(
    () => loadConfig({ AUTH_TOKEN: VALID_TOKEN, LOG_LEVEL: 'verbose' }),
    (err) => err.message.includes('LOG_LEVEL must be one of')
  );
});

test('loadConfig rejects an empty DATA_FILE', () => {
  assert.throws(
    () => loadConfig({ AUTH_TOKEN: VALID_TOKEN, DATA_FILE: '  ' }),
    (err) => err.message.includes('DATA_FILE must be a non-empty path')
  );
});

test('loadConfig keeps DATA_FILE inside ./data', () => {
  for (const value of [
    '../outside.json',
    '/etc/passwd',
    './tmp/tasks.json',
    '../../tmp/tasks.json'
  ]) {
    assert.throws(
      () => loadConfig({ AUTH_TOKEN: VALID_TOKEN, DATA_FILE: value }),
      (err) => err.message.includes('DATA_FILE must point inside ./data'),
      `expected ${value} to be rejected`
    );
  }
});

test('loadConfig aggregates multiple errors', () => {
  assert.throws(
    () => loadConfig({ PORT: 'abc', LOG_LEVEL: 'nope' }),
    (err) => {
      assert.equal(err.details.length >= 3, true);
      return true;
    }
  );
});
