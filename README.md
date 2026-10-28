# Node Backend Study

Estudo de servidor HTTP com Node.js puro, sem frameworks.

## Estado atual

- Servidor HTTP que responde `GET /` com `{ "message": "Hello World" }`.
- Resposta 404 em JSON para outras rotas.
- Teste automatizado com `node:test`.

## Como executar

```bash
node server.js
```

O servidor usa a variável `PORT` (padrão `3000`):

```bash
PORT=8080 node server.js
```

Acesse `http://localhost:3000/`.

## Como testar

```bash
npm test
```

Ou diretamente:

```bash
node --test
```

## Estrutura

- `app.js` — handler HTTP.
- `server.js` — inicialização do servidor.
- `server.test.js` — teste do endpoint principal.

## Tecnologias

Node.js, `node:http` e `node:test`.
