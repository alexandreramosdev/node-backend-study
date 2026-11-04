'use strict';

// ---------------------------------------------------------------------------
// src/repositories/memory.js
//
// Repositório em memória: os dados vivem em um Map enquanto o processo existir.
// O Map preserva a ordem de inserção, então a listagem é previsível.
//
// O contrato é assíncrono (async) de propósito: assim as rotas funcionam igual
// com este repositório e com o repositório de arquivo, que realmente precisa
// de await para I/O. Isso é inversão de dependência na prática.
//
// Também clonamos os objetos ao entrar/sair para que quem chamou não consiga
// mutar o estado interno do repositório por referência.
// ---------------------------------------------------------------------------

function cloneTask(task) {
  return { ...task };
}

function createMemoryRepository({ seed = [] } = {}) {
  const tasks = new Map();

  for (const task of seed) {
    tasks.set(task.id, cloneTask(task));
  }

  return {
    async list({ done, limit = Infinity, offset = 0 } = {}) {
      let items = [...tasks.values()];

      if (typeof done === 'boolean') {
        items = items.filter((task) => task.done === done);
      }

      // `total` é a contagem DEPOIS do filtro e ANTES da paginação: é o número
      // que o cliente usa para saber quantas páginas existem.
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
      return cloneTask(stored);
    },

    async update(id, changes) {
      const current = tasks.get(id);

      if (!current) {
        return null;
      }

      // A ordem do spread é intencional: id e createdAt vêm por último para
      // que `changes` não consiga alterá-los.
      const updated = {
        ...current,
        ...changes,
        id: current.id,
        createdAt: current.createdAt
      };

      tasks.set(id, updated);
      return cloneTask(updated);
    },

    async remove(id) {
      // Map.delete retorna true/false, que é exatamente o contrato esperado.
      return tasks.delete(id);
    }
  };
}

module.exports = { createMemoryRepository };
