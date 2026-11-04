'use strict';

// ---------------------------------------------------------------------------
// Helper de teste: sobe o servidor real em uma porta efêmera.
//
// - listen(0) pede ao SO uma porta livre, evitando conflito entre testes;
// - 127.0.0.1 evita ambiguidade entre IPv4/IPv6 do "localhost";
// - closeAllConnections() é necessário porque o fetch mantém conexões
//   keep-alive, e sem isso o server.close() poderia esperar para sempre.
// ---------------------------------------------------------------------------

const http = require('node:http');
const { createApp } = require('../../src/app');
const { createLogger } = require('../../src/logger');
const { createMemoryRepository } = require('../../src/repositories/memory');

function createSilentLogger() {
  return createLogger({
    level: 'error',
    sink: { log() {} },
    now: () => new Date('2026-01-01T00:00:00.000Z')
  });
}

async function startTestServer(options = {}) {
  const app = createApp({
    repository: options.repository || createMemoryRepository(),
    logger: options.logger || createSilentLogger(),
    config: options.config || {},
    now: options.now,
    uuid: options.uuid
  });

  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server,
    async close() {
      const closed = new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });

      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }

      await closed;
    }
  };
}

module.exports = { startTestServer, createSilentLogger };
