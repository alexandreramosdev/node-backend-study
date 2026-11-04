# Node Backend Study

Backend de estudo com **Node.js puro**, sem frameworks e sem dependências externas. A API de exemplo é um CRUD de `tasks`, construído para mostrar o que bibliotecas como Express e Fastify fazem por baixo dos panos.

## Requisitos

- Node.js >= 22 (usa `fetch`, `node:test`, `crypto.randomUUID` e `node:http`)

Nenhuma instalação de dependências é necessária.

## Como executar

Gere um token forte (mínimo de 16 caracteres; valores fracos como `dev-secret` são rejeitados):

```bash
export AUTH_TOKEN="$(openssl rand -hex 32)"
npm start
```

Ou diretamente:

```bash
AUTH_TOKEN="$(openssl rand -hex 32)" node server.js
```

Variáveis de ambiente:

| Variável | Padrão | Descrição |
|---|---|---|
| `HOST` | `127.0.0.1` | Interface de escuta; use `0.0.0.0` apenas com proxy/TLS e ciência do risco |
| `PORT` | `3000` | Porta HTTP (`0` escolhe uma porta aleatória) |
| `DATA_FILE` | `./data/tasks.json` | Arquivo de persistência; deve ficar dentro de `./data` |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` ou `error` |
| `AUTH_TOKEN` | obrigatório | Token Bearer das rotas de escrita (>= 16 caracteres) |

Exemplo completo:

```bash
HOST=127.0.0.1 PORT=8080 LOG_LEVEL=debug DATA_FILE=./data/tasks.json \
  AUTH_TOKEN="$(openssl rand -hex 32)" node server.js
```

O servidor cria o diretório `data/` com permissão restrita e o arquivo com modo `0600`. Ele encerra de forma graciosa com `Ctrl+C` (`SIGINT`) ou `SIGTERM`.

## Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/` | Não | `{ "message": "Hello World" }` |
| GET | `/health` | Não | `{ "status": "ok" }` |
| GET | `/tasks` | Não | Lista tarefas |
| GET | `/tasks/:id` | Não | Busca uma tarefa |
| POST | `/tasks` | Sim | Cria uma tarefa |
| PATCH | `/tasks/:id` | Sim | Atualiza `title` e/ou `done` |
| DELETE | `/tasks/:id` | Sim | Remove uma tarefa |

`GET /tasks` aceita:

- `done=true|false`
- `limit` (1..100, padrão 20)
- `offset` (>= 0, padrão 0)

A resposta é `{ "items": [...], "total": 0, "limit": 20, "offset": 0 }`.

### Exemplos com curl

```bash
# Use o mesmo token configurado no servidor
export AUTH_TOKEN="cole-o-token-aqui"

# Rotas públicas
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/tasks

# Criar
curl -i -X POST http://127.0.0.1:3000/tasks \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"title":"Estudar Node"}'

# Buscar
curl -i http://127.0.0.1:3000/tasks/<id>

# Atualizar
curl -i -X PATCH http://127.0.0.1:3000/tasks/<id> \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"done":true}'

# Remover
curl -i -X DELETE http://127.0.0.1:3000/tasks/<id> \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Filtrar e paginar
curl -i 'http://127.0.0.1:3000/tasks?done=false&limit=10&offset=0'
```

## Contrato de erro

```json
{ "error": { "code": "NOT_FOUND", "message": "Task not found" } }
```

| HTTP | Código | Quando |
|---|---|---|
| 400 | `BAD_REQUEST` | URL/encoding inválido |
| 400 | `INVALID_JSON` | JSON vazio ou malformado |
| 400 | `VALIDATION_ERROR` | Campo ausente, tipo errado ou valor inválido |
| 401 | `UNAUTHORIZED` | Token ausente ou inválido |
| 404 | `NOT_FOUND` | Rota ou recurso inexistente |
| 405 | `METHOD_NOT_ALLOWED` | Caminho existe, método não |
| 413 | `PAYLOAD_TOO_LARGE` | Body acima de 1 MiB (a conexão é encerrada) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` não é JSON |
| 429 | `TOO_MANY_REQUESTS` | Muitas falhas de autenticação do mesmo IP |
| 500 | `INTERNAL_ERROR` | Exceção não prevista |

Detalhes:

- Escritas exigem `Content-Type: application/json`.
- Erros nunca expõem stack trace.
- Campos desconhecidos, `id` e `createdAt` são rejeitados.
- O token é comparado com `crypto.timingSafeEqual` e nunca é registrado em log.
- Após 10 falhas de token do mesmo IP em 60s, novas tentativas recebem `429` com `Retry-After`.
- Respostas incluem `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Frame-Options: DENY`.

## Estrutura

```text
.
├── app.js                  # exporta a fábrica createApp (sem handler inseguro)
├── server.js               # config, repositório, listen, timeouts e shutdown
├── src/
│   ├── app.js              # createApp: compõe middlewares e rotas (auth fail-closed)
│   ├── config.js           # validação das variáveis de ambiente
│   ├── logger.js           # log estruturado em JSON
│   ├── core/               # router, body, request, response, errors, compose
│   ├── domain/             # validação e criação de Task
│   ├── middleware/         # logger, auth (rate limit), json-body, error-handler
│   ├── repositories/       # memory e file (JSON atômico)
│   └── routes/             # system e tasks
└── test/
    ├── helpers/
    ├── unit/
    └── integration/
```

`app.js` exporta `{ createApp }`. O handler exige token por padrão:

```js
const http = require('node:http');
const { createApp } = require('./app');

const app = createApp({
  config: { authToken: process.env.AUTH_TOKEN }
});

http.createServer(app);
```

Para testes, a desativação é explícita: `createApp({ config: { auth: false } })`.

## Como testar

```bash
npm test
```

Ou um arquivo específico:

```bash
node --test test/unit/router.test.js
node --test test/integration/tasks.test.js
```

Os testes de integração sobem o servidor real em `127.0.0.1` com porta `0`, usam `fetch` nativo e isolam o estado por teste.

## Decisões didáticas

- **Router manual**: resolve caminho antes do método para devolver 404 e 405 corretos, além de `Allow`.
- **Handlers retornam `ResponseSpec`**: serialização e envio ficam centralizados.
- **Auth fail-closed**: `createApp` exige token; a ausência só é permitida com `auth: false` explícito em testes.
- **Bind local por padrão**: `HOST=127.0.0.1`; expor na rede é uma decisão consciente.
- **Rate limit em memória**: 10 falhas de auth por IP em 60s geram `429`/`Retry-After`.
- **Repositórios assíncronos**: `memory` e `file` têm o mesmo contrato.
- **Persistência atômica**: arquivo temporário + `rename`, fila de escrita, rollback em falha e permissões `0600/0700`.
- **`DATA_FILE` restrito**: o caminho precisa ficar dentro de `./data`.
- **Middlewares**: composição explícita (`logger → error handler → router → auth → body parser`).
- **Config fail-fast**: variáveis inválidas impedem o startup.
- **Headers de segurança** e `Cache-Control: no-store` em todas as respostas.
- **Zero dependências**: inclusive em desenvolvimento; testes com `node:test` e `assert`.

## Limitações

Projeto didático, não pronto para produção:

- Token estático, sem rotação, escopos ou multiusuário.
- Rate limit em memória, por processo; não é distribuído.
- Sem HTTPS/TLS, CORS ou observabilidade avançada.
- Um único processo e um único arquivo JSON; não há coordenação entre processos.
- Cada escrita reescreve o arquivo inteiro.
- Sem uploads, streaming, WebSockets ou banco de dados.
- Para expor fora da máquina, use proxy reverso com TLS, rate limiting e autenticação adequada.

Consulte `SPEC.md` para o contrato completo e as fases de estudo.
