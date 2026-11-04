# Node Backend Study

Backend de estudo com **Node.js puro**, sem frameworks e sem dependências externas. A API de exemplo é um CRUD de `tasks`, construído para mostrar o que bibliotecas como Express e Fastify fazem por baixo dos panos.

## Requisitos

- Node.js >= 18.17 (usa `fetch`, `node:test`, `crypto.randomUUID` e `node:http`)

Nenhuma instalação de dependências é necessária.

## Como executar

```bash
AUTH_TOKEN=dev-secret npm start
```

Variáveis de ambiente:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP (`0` escolhe uma porta aleatória) |
| `DATA_FILE` | `./data/tasks.json` | Arquivo de persistência |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` ou `error` |
| `AUTH_TOKEN` | obrigatório | Token Bearer das rotas de escrita |
| `NODE_ENV` | `development` | Informativo |

Exemplo completo:

```bash
PORT=8080 LOG_LEVEL=debug DATA_FILE=./data/tasks.json \
  AUTH_TOKEN=dev-secret node server.js
```

O servidor cria o diretório do arquivo de dados automaticamente. Ele encerra de forma graciosa com `Ctrl+C` (`SIGINT`) ou `SIGTERM`.

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
# Rotas públicas
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/tasks

# Criar
curl -i -X POST http://127.0.0.1:3000/tasks \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer dev-secret' \
  -d '{"title":"Estudar Node"}'

# Buscar
curl -i http://127.0.0.1:3000/tasks/<id>

# Atualizar
curl -i -X PATCH http://127.0.0.1:3000/tasks/<id> \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer dev-secret' \
  -d '{"done":true}'

# Remover
curl -i -X DELETE http://127.0.0.1:3000/tasks/<id> \
  -H 'Authorization: Bearer dev-secret'

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
| 413 | `PAYLOAD_TOO_LARGE` | Body acima de 1 MiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` não é JSON |
| 500 | `INTERNAL_ERROR` | Exceção não prevista |

Detalhes:

- Escritas exigem `Content-Type: application/json`.
- Erros nunca expõem stack trace.
- Campos desconhecidos, `id` e `createdAt` são rejeitados.
- O token é comparado com `crypto.timingSafeEqual` e nunca é registrado em log.

## Estrutura

```text
.
├── app.js                  # handler padrão (memória) + createApp
├── server.js               # config, repositório, listen e shutdown
├── src/
│   ├── app.js              # createApp: compõe middlewares e rotas
│   ├── config.js           # validação das variáveis de ambiente
│   ├── logger.js           # log estruturado em JSON
│   ├── core/               # router, body, request, response, errors, compose
│   ├── domain/             # validação e criação de Task
│   ├── middleware/         # logger, auth, json-body, error-handler
│   ├── repositories/       # memory e file (JSON atômico)
│   └── routes/             # system e tasks
└── test/
    ├── helpers/
    ├── unit/
    └── integration/
```

`app.js` continua exportando um handler pronto para `http.createServer(app)`. Para injetar dependências, use `require('./app').createApp({ ... })`.

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
- **Repositórios assíncronos**: `memory` e `file` têm o mesmo contrato.
- **Persistência atômica**: escrita em arquivo temporário seguida de `rename`, com fila para serializar gravações.
- **Middlewares**: composição explícita (`logger → error handler → router → auth → body parser`).
- **Config fail-fast**: variáveis inválidas impedem o startup.
- **Zero dependências**: inclusive em desenvolvimento; testes com `node:test` e `assert`.

## Limitações

Projeto didático, não pronto para produção:

- Token estático, sem rotação, escopos ou multiusuário.
- Sem HTTPS/TLS, CORS, rate limiting ou observabilidade avançada.
- Um único processo e um único arquivo JSON; não há coordenação entre processos.
- Cada escrita reescreve o arquivo inteiro.
- Sem uploads, streaming, WebSockets ou banco de dados.

Consulte `SPEC.md` para o contrato completo e as fases de estudo.
