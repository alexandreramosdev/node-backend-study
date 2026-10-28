const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// Vamos importar nosso app/server que criaremos em seguida
const app = require('./app');

test('GET / should return status 200 and welcome message', async () => {
  // Inicia um servidor de teste na porta 0 (porta aleatória disponível)
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const response = await fetch(`http://localhost:${port}/`);
    assert.strictEqual(response.status, 200);

    const data = await response.json();
    assert.deepStrictEqual(data, { message: 'Hello World' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
