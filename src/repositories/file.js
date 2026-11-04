'use strict';

// ---------------------------------------------------------------------------
// src/repositories/file.js
//
// Persistência em UM arquivo JSON. O arquivo é lido uma vez no boot e mantido
// em memória; cada escrita atualiza o Map e reescreve o arquivo inteiro
// ("write-through").
//
// Conceitos importantes:
//
// 1. Escrita atômica
//    Escrever direto em tasks.json pode deixar um arquivo pela metade se o
//    processo morrer no meio. A solução é escrever em um arquivo temporário
//    no MESMO diretório e depois fazer rename para o nome final. No mesmo
//    sistema de arquivos, rename é atômico.
//
// 2. Fila de escrita
//    Duas requisições podem tentar gravar ao mesmo tempo. `writeChain`
//    serializa as gravações e evita intercalar escritas.
//
// 3. Validação na carga
//    O arquivo pode ter sido editado à mão. Validamos envelope, formato das
//    tasks e ids duplicados; se estiver inválido, falhamos explicitamente em
//    vez de sobrescrever dados silenciosamente.
//
// Limitação didática: um único processo. Não há lock entre processos.
// ---------------------------------------------------------------------------

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { isPlainObject } = require('../domain/tasks');

const VERSION = 1;

function cloneTask(task) {
  return { ...task };
}

function isStoredTask(task) {
  return (
    isPlainObject(task) &&
    typeof task.id === 'string' &&
    task.id.length > 0 &&
    typeof task.title === 'string' &&
    typeof task.done === 'boolean' &&
    typeof task.createdAt === 'string'
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renameWithRetry(from, to, attempts = 3) {
  // No Windows, antivírus/índice podem segurar o arquivo temporariamente e
  // causar EPERM/EBUSY. Tentamos de novo algumas vezes antes de desistir.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const transient = err.code === 'EPERM' || err.code === 'EBUSY';

      if (!transient || attempt >= attempts) {
        await fs.rm(from, { force: true }).catch(() => {});
        throw err;
      }

      await delay(attempt * 10);
    }
  }
}

async function writeAtomic(filePath, data) {
  const directory = path.dirname(filePath);
  // O temporário fica no mesmo diretório para o rename não cruzar volumes.
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  try {
    await fs.writeFile(temporaryPath, data, 'utf8');
    await renameWithRetry(temporaryPath, filePath);
  } catch (err) {
    // Em caso de falha, não deixamos lixo para trás.
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw err;
  }
}

async function createFileRepository({ filePath } = {}) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new Error('createFileRepository requires a non-empty filePath');
  }

  const resolvedPath = path.resolve(filePath);
  const tasks = new Map();
  // Promise.resolve() funciona como uma fila vazia inicial.
  let writeChain = Promise.resolve();

  async function load() {
    // O diretório pode não existir no primeiro boot.
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    let raw;

    try {
      raw = await fs.readFile(resolvedPath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return; // primeira execução: começa vazio
      }

      throw err;
    }

    if (raw.trim().length === 0) {
      throw new Error(`Data file is empty: ${resolvedPath}`);
    }

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      // `cause` preserva o erro original sem expor isso ao cliente HTTP.
      throw new Error(`Data file contains invalid JSON: ${resolvedPath}`, {
        cause: err
      });
    }

    // Envelope versionado permite evoluir o formato no futuro.
    if (
      !isPlainObject(parsed) ||
      parsed.version !== VERSION ||
      !Array.isArray(parsed.tasks)
    ) {
      throw new Error(`Data file has an invalid envelope: ${resolvedPath}`);
    }

    for (const task of parsed.tasks) {
      if (!isStoredTask(task)) {
        throw new Error(`Data file contains an invalid task: ${resolvedPath}`);
      }

      if (tasks.has(task.id)) {
        throw new Error(`Data file contains a duplicate task id: ${resolvedPath}`);
      }

      tasks.set(task.id, cloneTask(task));
    }
  }

  function persist() {
    // O snapshot é tirado no momento da chamada, depois da mutação em memória.
    const data = JSON.stringify(
      { version: VERSION, tasks: [...tasks.values()] },
      null,
      2
    );

    // Encadeia a escrita atrás da anterior. Se uma falhar, o `catch` mantém a
    // fila viva para as próximas, e o erro ainda chega a quem chamou `persist`.
    const write = writeChain.then(() => writeAtomic(resolvedPath, data));
    writeChain = write.catch(() => {});

    return write;
  }

  await load();

  return {
    async list({ done, limit = Infinity, offset = 0 } = {}) {
      let items = [...tasks.values()];

      if (typeof done === 'boolean') {
        items = items.filter((task) => task.done === done);
      }

      // total = após filtro, antes da paginação.
      const total = items.length;
      const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
      const end = Number.isFinite(limit) ? start + limit : undefined;

      return {
        items: items.slice(start, end).map(cloneTask),
        total
      };
    },

    async findById(id) {
      const task = tasks.get(id);
      return task ? cloneTask(task) : null;
    },

    async create(task) {
      const stored = cloneTask(task);
      tasks.set(stored.id, stored);
      await persist(); // só responde depois que o disco confirmou
      return cloneTask(stored);
    },

    async update(id, changes) {
      const current = tasks.get(id);

      if (!current) {
        return null;
      }

      const updated = {
        ...current,
        ...changes,
        id: current.id,
        createdAt: current.createdAt
      };

      tasks.set(id, updated);
      await persist();
      return cloneTask(updated);
    },

    async remove(id) {
      const removed = tasks.delete(id);

      if (removed) {
        await persist();
      }

      return removed;
    }
  };
}

module.exports = { createFileRepository, VERSION };
