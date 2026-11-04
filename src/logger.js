'use strict';

// ---------------------------------------------------------------------------
// src/logger.js
//
// Logger mínimo, estruturado e sem dependências. Cada linha é um JSON com:
//   { time, level, msg, ...campos }
//
// Por que JSON em uma linha? Facilita ler com `jq`, filtrar e enviar para
// ferramentas de observabilidade sem parser próprio.
//
// `sink` e `now` são injetáveis para testes: em vez de escrever no console,
// podemos capturar as linhas em memória e comparar o conteúdo.
//
// Regra de segurança: nunca registrar body, query, headers, Authorization ou
// tokens. O logger só recebe os campos explicitamente passados.
// ---------------------------------------------------------------------------

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

function createLogger({ level = 'info', sink = console, now = () => new Date() } = {}) {
  const threshold = LEVELS[level];

  if (threshold === undefined) {
    throw new Error(`Invalid log level: ${level}`);
  }

  function write(levelName, message, fields = {}) {
    // Níveis abaixo do configurado são descartados (ex.: level=warn ignora info).
    if (LEVELS[levelName] < threshold) {
      return;
    }

    // `fields` vem primeiro de propósito: assim ele não consegue sobrescrever
    // os campos obrigatórios time/level/msg.
    const entry = {
      ...fields,
      time: now().toISOString(),
      level: levelName,
      msg: message
    };

    const line = JSON.stringify(entry);
    const method =
      typeof sink[levelName] === 'function'
        ? sink[levelName].bind(sink)
        : sink.log.bind(sink);

    method(line);
  }

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
    isLevelEnabled: (levelName) => LEVELS[levelName] >= threshold
  };
}

// Log padronizado de uma requisição. Inclui apenas metadados "seguros":
// não há query string, headers, body nem token.
function logRequest(
  logger,
  { requestId, method, pathname, status, durationMs }
) {
  if (!logger) {
    return;
  }

  const fields = {
    requestId,
    method,
    pathname,
    status,
    durationMs: Math.round(durationMs * 100) / 100
  };

  // 5xx é erro do servidor; 4xx é erro do cliente; o resto é fluxo normal.
  if (status >= 500) {
    logger.error('request completed', fields);
  } else if (status >= 400) {
    logger.warn('request completed', fields);
  } else {
    logger.info('request completed', fields);
  }
}

module.exports = { createLogger, logRequest, LEVELS };
