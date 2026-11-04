'use strict';

// ---------------------------------------------------------------------------
// server.js
//
// Ponto de entrada da aplicação. Responsabilidades:
//   1. ler e validar a configuração (variáveis de ambiente);
//   2. criar o logger, o repositório e a aplicação;
//   3. abrir o servidor HTTP;
//   4. tratar SIGINT/SIGTERM com shutdown gracioso.
//
// A lógica HTTP fica em src/app.js. Separar bootstrap de aplicação permite
// testar o handler sem abrir uma porta e sem efeitos colaterais no import.
// ---------------------------------------------------------------------------

const http = require('node:http');
const path = require('node:path');
const { loadConfig, ConfigError } = require('./src/config');
const { createLogger } = require('./src/logger');
const { createRepository } = require('./src/repositories');
const { createApp } = require('./src/app');

async function main() {
  // `loadConfig` falha rápido (fail-fast): se PORT, DATA_FILE, LOG_LEVEL ou
  // AUTH_TOKEN estiverem inválidos, o processo nem chega a abrir a porta.
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });

  // O repositório de arquivo é assíncrono porque carrega o JSON no boot.
  const repository = await createRepository(config);
  const app = createApp({ repository, logger, config });
  const server = http.createServer(app);

  // Timeouts e limites explícitos reduzem slowloris e exaustão de conexões.
  // headersTimeout precisa ser <= requestTimeout para o Node não reclamar.
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxConnections = 1_000;
  server.maxRequestsPerSocket = 100;
  server.maxHeadersCount = 100;

  // Erros de rede (por exemplo, EADDRINUSE) chegam por este evento, não pelo
  // await de listen. Sem este handler, o processo continuaria rodando.
  server.on('error', (err) => {
    logger.error('server error', { error: err.message });
    process.exit(1);
  });

  // `listen` é assíncrono: o Promise resolve no evento "listening".
  // O host padrão é 127.0.0.1 (loopback), não todas as interfaces.
  await new Promise((resolve) => {
    server.listen(config.port, config.host, resolve);
  });

  const address = server.address();
  logger.info('server listening', {
    host: config.host,
    port: address.port,
    // Logamos apenas o basename para não expor a estrutura de diretórios.
    dataFile: path.basename(config.dataFile)
  });

  let shuttingDown = false;

  function shutdown(signal) {
    // Evita executar o shutdown duas vezes se dois sinais chegarem juntos.
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info('shutting down', { signal });

    // Rede de segurança: se alguma conexão não terminar, força a saída depois
    // do timeout para o processo não ficar preso para sempre.
    const timeout = setTimeout(() => {
      logger.error('shutdown timed out; forcing exit');
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      process.exit(1);
    }, config.shutdownTimeoutMs);

    // unref() não mantém o processo vivo apenas por causa deste timer.
    timeout.unref();

    // server.close() para de aceitar novas conexões e espera as requisições
    // em andamento terminarem antes de chamar o callback.
    server.close((err) => {
      clearTimeout(timeout);

      if (err) {
        logger.error('error while closing server', { error: err.message });
        process.exit(1);
      }

      logger.info('server closed');
      process.exit(0);
    });

    // Conexões keep-alive ociosas atrasariam o close(); fechá-las é seguro.
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Só inicia o servidor quando o arquivo é executado diretamente.
// Ao importar server.js em um teste, `main` fica disponível sem abrir porta.
if (require.main === module) {
  main().catch((err) => {
    // ConfigError já traz uma mensagem amigável e não deve vazar o token.
    // Para os demais erros, evitamos imprimir stack trace no console.
    console.error(
      err instanceof ConfigError
        ? err.message
        : `Failed to start server: ${err.message}`
    );

    process.exitCode = 1;
  });
}

module.exports = { main };
