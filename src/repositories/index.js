'use strict';

// ---------------------------------------------------------------------------
// src/repositories/index.js
//
// Factory: escolhe a implementação de repositório conforme a configuração.
// As rotas conhecem apenas o contrato (list/findById/create/update/remove),
// então trocar memória por arquivo não muda nada na camada HTTP.
// ---------------------------------------------------------------------------

const { createMemoryRepository } = require('./memory');
const { createFileRepository } = require('./file');

async function createRepository(config = {}) {
  // `repository: 'memory'` é útil para testes/experimentos sem tocar no disco.
  if (config.repository === 'memory') {
    return createMemoryRepository();
  }

  // Com DATA_FILE configurado (o padrão), usamos persistência em JSON.
  if (config.dataFile) {
    return createFileRepository({ filePath: config.dataFile });
  }

  return createMemoryRepository();
}

module.exports = { createRepository };
