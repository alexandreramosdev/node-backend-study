'use strict';

// ---------------------------------------------------------------------------
// src/domain/tasks.js
//
// Regras de negócio da Task, independentes de HTTP e de persistência.
// Aqui respondemos perguntas como:
//   - o body tem o formato esperado?
//   - `title` é texto não vazio e com até 200 caracteres?
//   - `done` é booleano de verdade (sem converter "true" string)?
//   - quais campos podem ser criados/alterados?
//
// Rejeitar campos desconhecidos evita "mass assignment": um cliente não pode
// enviar { id } ou { createdAt } e sobrescrever valores internos.
//
// `buildTask` recebe `now` e `uuid` injetáveis para que testes possam gerar
// ids/datas determinísticos sem mock global.
// ---------------------------------------------------------------------------

const { randomUUID } = require('node:crypto');
const { validation } = require('../core/errors');

const MAX_TITLE_LENGTH = 200;
const CREATE_FIELDS = ['title', 'done'];
const PATCH_FIELDS = ['title', 'done'];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
  // JSON.parse pode devolver array, null ou primitivo; só aceitamos objeto.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertPlainObject(input) {
  if (!isPlainObject(input)) {
    throw validation('Request body must be a JSON object');
  }
}

function assertKnownFields(input, allowedFields) {
  for (const key of Object.keys(input)) {
    if (!allowedFields.includes(key)) {
      // Mensagem genérica: não ecoamos o nome do campo enviado pelo cliente,
      // evitando reflexão de conteúdo em respostas de erro.
      throw validation('Request body contains an unknown field');
    }
  }
}

function validateTitle(value) {
  if (typeof value !== 'string') {
    throw validation('"title" must be a string');
  }

  // Guardamos o título sem espaços nas pontas.
  const title = value.trim();

  if (title.length === 0) {
    throw validation('"title" must not be empty');
  }

  // .length conta unidades UTF-16; um emoji pode contar como 2. Para este
  // estudo é suficiente e é o mesmo critério que bancos/validadores usam.
  if (title.length > MAX_TITLE_LENGTH) {
    throw validation(
      `"title" must be at most ${MAX_TITLE_LENGTH} characters`
    );
  }

  return title;
}

function validateDone(value) {
  // Sem coerção: "true" (string) é inválido, só true/false passam.
  if (typeof value !== 'boolean') {
    throw validation('"done" must be a boolean');
  }

  return value;
}

function validateCreate(input) {
  assertPlainObject(input);
  assertKnownFields(input, CREATE_FIELDS);

  if (!hasOwn(input, 'title')) {
    throw validation('"title" is required');
  }

  return {
    title: validateTitle(input.title),
    done: hasOwn(input, 'done') ? validateDone(input.done) : false
  };
}

function validatePatch(input) {
  assertPlainObject(input);
  assertKnownFields(input, PATCH_FIELDS);

  const hasTitle = hasOwn(input, 'title');
  const hasDone = hasOwn(input, 'done');

  // PATCH parcial, mas vazio não faz sentido: pelo menos um campo é exigido.
  if (!hasTitle && !hasDone) {
    throw validation('At least one of "title" or "done" is required');
  }

  // Só incluímos no objeto as chaves realmente enviadas.
  const changes = {};

  if (hasTitle) {
    changes.title = validateTitle(input.title);
  }

  if (hasDone) {
    changes.done = validateDone(input.done);
  }

  return changes;
}

function buildTask(
  input,
  {
    now = () => new Date(),
    uuid = () => randomUUID()
  } = {}
) {
  return {
    id: uuid(),
    title: input.title,
    done: input.done,
    // Sempre ISO 8601 em UTC, independente do fuso/localidade do servidor.
    createdAt: now().toISOString()
  };
}

module.exports = {
  MAX_TITLE_LENGTH,
  isPlainObject,
  validateCreate,
  validatePatch,
  validateTitle,
  validateDone,
  buildTask
};
