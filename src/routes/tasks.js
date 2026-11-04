'use strict';

// ---------------------------------------------------------------------------
// src/routes/tasks.js
//
// Camada HTTP do recurso `tasks`. Responsabilidades:
// - validar query string (aqui) e body (via domain/tasks.js);
// - orquestrar as chamadas ao repositório;
// - traduzir "não encontrado" em 404;
// - devolver um ResponseSpec.
//
// A regra de negócio em si fica em domain/tasks.js; a persistência fica no
// repositório. Este arquivo só conecta as duas coisas.
// ---------------------------------------------------------------------------

const { validation, notFound } = require('../core/errors');
const { json, empty } = require('../core/response');
const {
  validateCreate,
  validatePatch,
  buildTask
} = require('../domain/tasks');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Query strings chegam como texto. Validamos com regex antes de converter para
// número para evitar surpresas do tipo Number('') === 0 ou parseInt permissivo.
function parseDone(searchParams) {
  if (!searchParams.has('done')) {
    return undefined;
  }

  const value = searchParams.get('done');

  if (value !== 'true' && value !== 'false') {
    throw validation('"done" must be "true" or "false"');
  }

  return value === 'true';
}

function parseLimit(searchParams) {
  if (!searchParams.has('limit')) {
    return DEFAULT_LIMIT;
  }

  const raw = searchParams.get('limit');

  if (!/^\d+$/.test(raw)) {
    throw validation(`"limit" must be an integer between 1 and ${MAX_LIMIT}`);
  }

  const value = Number(raw);

  if (value < 1 || value > MAX_LIMIT) {
    throw validation(`"limit" must be an integer between 1 and ${MAX_LIMIT}`);
  }

  return value;
}

function parseOffset(searchParams) {
  if (!searchParams.has('offset')) {
    return 0;
  }

  const raw = searchParams.get('offset');

  if (!/^\d+$/.test(raw)) {
    throw validation('"offset" must be a non-negative integer');
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value)) {
    throw validation('"offset" must be a non-negative integer');
  }

  return value;
}

function parseListQuery(searchParams) {
  return {
    done: parseDone(searchParams),
    limit: parseLimit(searchParams),
    offset: parseOffset(searchParams)
  };
}

function registerTaskRoutes(router, { repository, now, uuid }) {
  router.add('GET', '/tasks', async (ctx) => {
    const query = parseListQuery(ctx.query);
    const { items, total } = await repository.list(query);

    return json(200, {
      items,
      total,
      limit: query.limit,
      offset: query.offset
    });
  });

  router.add('GET', '/tasks/:id', async (ctx) => {
    const task = await repository.findById(ctx.params.id);

    if (!task) {
      // O errorHandler transforma o AppError em 404 no formato padrão.
      throw notFound('Task not found');
    }

    return json(200, task);
  });

  router.add('POST', '/tasks', async (ctx) => {
    // `ctx.body` já foi lido e parseado pelo middleware jsonBody.
    const data = validateCreate(ctx.body);
    const task = buildTask(data, { now, uuid });

    await repository.create(task);

    // 201 Created + Location apontando para o recurso criado.
    return json(201, task, { Location: `/tasks/${task.id}` });
  });

  router.add('PATCH', '/tasks/:id', async (ctx) => {
    const changes = validatePatch(ctx.body);
    const task = await repository.update(ctx.params.id, changes);

    if (!task) {
      throw notFound('Task not found');
    }

    return json(200, task);
  });

  router.add('DELETE', '/tasks/:id', async (ctx) => {
    const removed = await repository.remove(ctx.params.id);

    if (!removed) {
      throw notFound('Task not found');
    }

    // 204 No Content: sucesso sem corpo.
    return empty(204);
  });
}

module.exports = { registerTaskRoutes, parseListQuery };
