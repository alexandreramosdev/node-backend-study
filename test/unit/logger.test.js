'use strict';

// Testes do logger estruturado: filtro por nível, campos obrigatórios e
// escolha de nível do logRequest (info/warn/error).

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogger, logRequest } = require('../../src/logger');

function captureSink() {
  const lines = [];

  return {
    lines,
    log(line) {
      lines.push(JSON.parse(line));
    }
  };
}

const fixedNow = () => new Date('2026-01-01T00:00:00.000Z');

test('logger filters messages below the configured level', () => {
  const sink = captureSink();
  const logger = createLogger({ level: 'warn', sink, now: fixedNow });

  logger.debug('ignored');
  logger.info('ignored');
  logger.warn('kept');
  logger.error('kept too');

  assert.deepEqual(
    sink.lines.map((line) => line.msg),
    ['kept', 'kept too']
  );
});

test('logger writes structured JSON with core fields', () => {
  const sink = captureSink();
  const logger = createLogger({ level: 'debug', sink, now: fixedNow });

  logger.info('hello', { requestId: 'abc', level: 'fake' });

  assert.deepEqual(sink.lines[0], {
    requestId: 'abc',
    time: '2026-01-01T00:00:00.000Z',
    level: 'info',
    msg: 'hello'
  });
});

test('logRequest chooses the level based on the status', () => {
  const sink = captureSink();
  const logger = createLogger({ level: 'debug', sink, now: fixedNow });

  logRequest(logger, {
    requestId: '1',
    method: 'GET',
    pathname: '/tasks',
    status: 200,
    durationMs: 1.234
  });
  logRequest(logger, {
    requestId: '2',
    method: 'GET',
    pathname: '/tasks/missing',
    status: 404,
    durationMs: 2
  });
  logRequest(logger, {
    requestId: '3',
    method: 'GET',
    pathname: '/tasks',
    status: 500,
    durationMs: 3
  });

  assert.deepEqual(
    sink.lines.map((line) => line.level),
    ['info', 'warn', 'error']
  );
  assert.equal(sink.lines[0].durationMs, 1.23);
});

test('createLogger rejects an unknown level', () => {
  assert.throws(() => createLogger({ level: 'verbose' }), /Invalid log level/);
});
