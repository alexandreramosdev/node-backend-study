'use strict';

// ---------------------------------------------------------------------------
// src/config.js
//
// Lê as variáveis de ambiente UMA vez, no boot, e devolve um objeto validado.
// A ideia é "fail-fast": é melhor o processo não subir do que descobrir uma
// porta inválida só na primeira requisição.
//
// Não usamos dotenv (zero dependências). As variáveis vêm do shell:
//
//   AUTH_TOKEN=dev-secret PORT=3000 node server.js
//
// Os parsers recebem um array `errors` para que TODOS os problemas sejam
// reportados juntos em uma única ConfigError.
// ---------------------------------------------------------------------------

const path = require('node:path');

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_DATA_FILE = './data/tasks.json';
const DEFAULT_LOG_LEVEL = 'info';
const MIN_AUTH_TOKEN_LENGTH = 16;
const WEAK_AUTH_TOKENS = new Set([
  'changeme',
  'dev-secret',
  'password',
  'secret',
  'token'
]);

function isWeakAuthToken(token) {
  const normalized = token.toLowerCase();

  return [...WEAK_AUTH_TOKENS].some(
    (weak) =>
      normalized === weak ||
      normalized.startsWith(`${weak}-`) ||
      normalized.startsWith(`${weak}_`)
  );
}

// Por segurança, o arquivo de dados deve ficar dentro de ./data. Isso impede
// que uma variável DATA_FILE maliciosa aponte para /etc/passwd ou outro arquivo
// gravável do sistema.
const DATA_DIR = path.resolve(process.cwd(), 'data');

class ConfigError extends Error {
  constructor(details) {
    super(`Invalid configuration:\n- ${details.join('\n- ')}`);
    this.name = 'ConfigError';
    this.details = details;
  }
}

function parsePort(raw, errors) {
  if (raw === undefined) {
    return DEFAULT_PORT;
  }

  // Aceita apenas dígitos. Isso rejeita "3000abc", "1.5" e "-1" de propósito,
  // evitando o comportamento permissivo de parseInt.
  if (!/^\d+$/.test(raw)) {
    errors.push('PORT must be an integer between 0 and 65535');
    return undefined;
  }

  const value = Number(raw);

  if (value > 65535) {
    errors.push('PORT must be an integer between 0 and 65535');
    return undefined;
  }

  // Porta 0 é válida: o sistema operacional escolhe uma porta livre.
  return value;
}

function parseHost(raw, errors) {
  if (raw === undefined) {
    // Escutar apenas no loopback evita expor a API na rede local por acidente.
    return DEFAULT_HOST;
  }

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    errors.push('HOST must be a non-empty string');
    return undefined;
  }

  return raw.trim();
}

function parseDataFile(raw, errors) {
  const value = raw === undefined ? DEFAULT_DATA_FILE : raw;

  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push('DATA_FILE must be a non-empty path');
    return undefined;
  }

  try {
    // Caminhos relativos são resolvidos a partir do diretório em que o processo
    // foi iniciado, não do arquivo config.js.
    const resolved = path.resolve(process.cwd(), value.trim());
    const relative = path.relative(DATA_DIR, resolved);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      errors.push('DATA_FILE must point inside ./data');
      return undefined;
    }

    return resolved;
  } catch {
    // path.resolve pode lançar com entradas exóticas (ex.: null byte).
    errors.push('DATA_FILE must be a valid path');
    return undefined;
  }
}

function parseLogLevel(raw, errors) {
  if (raw === undefined) {
    return DEFAULT_LOG_LEVEL;
  }

  const value = String(raw).toLowerCase();

  if (!LOG_LEVELS.includes(value)) {
    errors.push(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}`);
    return undefined;
  }

  return value;
}

function parseAuthToken(raw, errors) {
  if (raw === undefined) {
    // O token é obrigatório: as rotas de escrita não ficam abertas por padrão.
    errors.push('AUTH_TOKEN is required to start the server');
    return undefined;
  }

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    errors.push('AUTH_TOKEN must be a non-empty string');
    return undefined;
  }

  const token = raw.trim();

  if (token.length < MIN_AUTH_TOKEN_LENGTH) {
    errors.push(
      `AUTH_TOKEN must be at least ${MIN_AUTH_TOKEN_LENGTH} characters`
    );
    return undefined;
  }

  if (isWeakAuthToken(token)) {
    errors.push('AUTH_TOKEN must not be a common/weak value');
    return undefined;
  }

  // Nunca logamos o valor do token; aqui ele só é normalizado.
  return token;
}

function loadConfig(env = process.env) {
  const errors = [];

  const port = parsePort(env.PORT, errors);
  const host = parseHost(env.HOST, errors);
  const dataFile = parseDataFile(env.DATA_FILE, errors);
  const logLevel = parseLogLevel(env.LOG_LEVEL, errors);
  const authToken = parseAuthToken(env.AUTH_TOKEN, errors);

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }

  return {
    port,
    host,
    dataFile,
    logLevel,
    authToken,
    bodyLimit: 1024 * 1024, // 1 MiB
    shutdownTimeoutMs: 10000
  };
}

module.exports = {
  ConfigError,
  LOG_LEVELS,
  loadConfig
};
