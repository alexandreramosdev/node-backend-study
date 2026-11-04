# SPEC — Tasks API com Node nativo

## Objetivo

Projeto de estudo de backend com Node.js puro (sem frameworks e sem dependências externas), cobrindo do básico ao intermediário. O recurso de exemplo é `tasks`, e cada camada existe para ensinar uma responsabilidade real de backend: HTTP, roteamento, parsing, validação, erros, persistência, configuração, autenticação, logging e shutdown.

Público-alvo: desenvolvedores iniciantes/intermediários que querem entender o que frameworks como Express e Fastify abstraem.

## Escopo

### MVP

- `GET /` → `200 { "message": "Hello World" }`
- `GET /health` → `200 { "status": "ok" }`
- Roteamento manual por método + path, com parâmetro `:id`
- `404` para rota inexistente e `405` com header `Allow` para método não suportado
- CRUD de tasks em memória:
  - `GET /tasks`
  - `GET /tasks/:id`
  - `POST /tasks` → `201` + `Location`
  - `PATCH /tasks/:id`
  - `DELETE /tasks/:id` → `204`
- Body JSON apenas com `Content-Type: application/json`
  - JSON inválido/vazio → `400 INVALID_JSON`
  - body acima de 1 MiB → `413 PAYLOAD_TOO_LARGE` com `Connection: close`
  - content-type inválido → `415 UNSUPPORTED_MEDIA_TYPE`
- Validação de `title` (string, `trim`, 1..200) e `done` (boolean)
- Campos desconhecidos, `id` e `createdAt` são rejeitados
- Erros padronizados em `{ "error": { "code": "...", "message": "..." } }`, sem stack trace
- Log de cada requisição (método, path, status, duração)
- Testes com `node:test` em porta efêmera
- README com execução, endpoints e exemplos `curl`

### Fase 2 (intermediário)

- Persistência em um único arquivo JSON com escrita atômica (`tmp` + `rename`), permissões `0600/0700` e rollback em falha
- Repositórios `memory` e `file` selecionáveis por configuração
- Middlewares caseiros: logger, body parser, auth (com rate limit) e error handler, compostos por `compose`
- Configuração por variáveis de ambiente validada no boot: `HOST`, `PORT`, `DATA_FILE`, `LOG_LEVEL`, `AUTH_TOKEN`
- Bind padrão em `127.0.0.1`; exposição externa exige decisão consciente
- Autenticação Bearer estática nas rotas de escrita, com `crypto.timingSafeEqual`
- Lockout por IP após 10 falhas de auth em 60s (`429` + `Retry-After`)
- Paginação (`limit`, `offset`) e filtro (`done`) em `GET /tasks`
- Headers de segurança e `Cache-Control: no-store`
- Timeouts e limites de conexão explícitos no servidor
- Graceful shutdown em `SIGINT`/`SIGTERM`
- Testes de integração com arquivo temporário isolado

### Fora de escopo

Frameworks, ORMs, banco de dados, Docker, deploy, CI/CD, TypeScript, frontend, upload de arquivos, OAuth/JWT completo, RBAC, HTTPS, rate limiting distribuído, cache, filas, WebSockets, métricas, tracing e metas de produção.

## Contrato HTTP

| Método | Rota | Sucesso | Erros principais |
|---|---|---|---|
| GET | `/` | 200 `{ "message": "Hello World" }` | — |
| GET | `/health` | 200 `{ "status": "ok" }` | — |
| GET | `/tasks` | 200 `{ items, total, limit, offset }` | 400 |
| GET | `/tasks/:id` | 200 `Task` | 404 |
| POST | `/tasks` | 201 `Task` + `Location: /tasks/{id}` | 400, 401, 413, 415, 429 |
| PATCH | `/tasks/:id` | 200 `Task` | 400, 401, 404, 413, 415, 429 |
| DELETE | `/tasks/:id` | 204 sem corpo | 401, 404, 429 |
| qualquer | caminho conhecido, método não registrado | 405 + `Allow` | — |
| qualquer | caminho desconhecido | 404 | — |

### Task

```text
Task = {
  id: string,          // crypto.randomUUID()
  title: string,       // trim, 1..200 caracteres
  done: boolean,       // padrão false na criação
  createdAt: string    // ISO 8601 UTC
}
```

### Erros

```text
{ "error": { "code": string, "message": string } }
```

| HTTP | code | Quando |
|---|---|---|
| 400 | `BAD_REQUEST` | URL/percent-encoding inválido |
| 400 | `INVALID_JSON` | corpo JSON vazio ou malformado |
| 400 | `VALIDATION_ERROR` | campo ausente, tipo errado ou valor inválido |
| 401 | `UNAUTHORIZED` | token ausente/inválido |
| 404 | `NOT_FOUND` | rota ou recurso inexistente |
| 405 | `METHOD_NOT_ALLOWED` | caminho existe, método não |
| 413 | `PAYLOAD_TOO_LARGE` | corpo acima de 1 MiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` não é JSON |
| 429 | `TOO_MANY_REQUESTS` | muitas falhas de auth do mesmo IP |
| 500 | `INTERNAL_ERROR` | exceção não prevista |

## Estrutura

```text
node-backend-study/
├── app.js                      # exporta a fábrica createApp (auth fail-closed)
├── server.js                   # bootstrap: config, repositório, listen, timeouts, shutdown
├── package.json
├── SPEC.md
├── README.md
├── src/
│   ├── app.js                  # createApp(deps) → handler HTTP
│   ├── config.js               # loadConfig(env) validado
│   ├── logger.js               # logger estruturado
│   ├── core/
│   │   ├── body.js             # leitura/parse JSON com limite
│   │   ├── compose.js          # composição de middlewares
│   │   ├── errors.js           # AppError + conversão para resposta
│   │   ├── request.js          # normalização de método/URL/query/headers
│   │   ├── response.js         # ResponseSpec + envio JSON
│   │   └── router.js           # rotas manuais, params e Allow
│   ├── domain/tasks.js         # validação e criação de Task
│   ├── middleware/
│   │   ├── auth.js             # Bearer estático + timingSafeEqual
│   │   ├── error-handler.js
│   │   ├── json-body.js
│   │   └── logger.js
│   ├── repositories/
│   │   ├── index.js            # factory memory|file
│   │   ├── memory.js
│   │   └── file.js             # JSON único + escrita atômica
│   └── routes/
│       ├── index.js
│       ├── system.js           # / e /health
│       └── tasks.js            # CRUD /tasks
└── test/
    ├── helpers/
    ├── unit/
    └── integration/
```

## Decisões

- Zero dependências em runtime e desenvolvimento; apenas módulos nativos.
- Node.js >= 22, CommonJS, sem TypeScript.
- `createApp` exportado sem `listen`; testes usam porta `0` e `127.0.0.1`.
- Auth fail-closed: `createApp` exige `config.authToken`; desativação só com `auth: false` explícito em testes.
- Bind padrão em `127.0.0.1` via `HOST`; `0.0.0.0` é opt-in.
- Router manual resolve primeiro o caminho e depois o método, garantindo 404/405 corretos.
- Handlers retornam `ResponseSpec`; o núcleo centraliza serialização e envio.
- Repositório tem contrato assíncrono mesmo em memória, permitindo trocar por arquivo.
- `GET /tasks` retorna `{ items, total, limit, offset }`; filtro `done`; `limit` padrão 20 (máx 100), `offset` padrão 0, ordem de inserção.
- `DELETE` de id inexistente → `404`; `PATCH {}` → `400`; escrita sem JSON → `415`.
- Auth via token estático em `AUTH_TOKEN` (>= 16 caracteres, sem valores fracos), obrigatório no startup; `GET` permanece público.
- Lockout em memória: 10 falhas de auth por IP em 60s → `429` com `Retry-After`.
- Persistência em `DATA_FILE` restrito a `./data`, no formato `{ "version": 1, "tasks": [] }`, com carga no boot, escrita atômica, rollback e permissões restritas.
- Headers de segurança e `Cache-Control: no-store` em todas as respostas.
- Timeouts/limites explícitos: `headersTimeout`, `requestTimeout`, `keepAliveTimeout`, `maxConnections`, `maxRequestsPerSocket`, `maxHeadersCount`.
- Mensagens da API em inglês; documentação em português. Sem `updatedAt`.
- Logs nunca incluem body, headers, `Authorization`, token ou caminho absoluto de dados.

## Fases de implementação

| Fase | Entrega |
|---|---|
| 0 | Scripts `start`/`test`, `engines`, helpers, `.gitignore` |
| 1 | Router, erros, response/request, `/` e `/health`, 404/405 |
| 2 | CRUD em memória (tasks) |
| 3 | Body parser e bordas 400/413/415 + validação |
| 4 | Log por requisição + README do MVP |
| 5 | Middlewares + config validada |
| 6 | Repositório de arquivo com escrita atômica |
| 7 | Auth Bearer nas rotas de escrita + lockout por IP |
| 8 | Paginação e filtro `done` |
| 9 | Graceful shutdown, timeouts, headers de segurança e README final |

## Verificação

```bash
npm test
node --test test/unit/router.test.js
node --test test/integration/tasks.test.js
AUTH_TOKEN="$(openssl rand -hex 32)" node server.js
```

## Limitações e segurança

- Projeto didático; não deve ser exposto em produção sem TLS, proxy reverso e autenticação adequada.
- Token estático sem rotação, escopos ou multiusuário.
- Rate limit em memória e por processo; não é distribuído.
- Um único processo; não há coordenação entre processos para o arquivo JSON.
- Escrita no arquivo reescreve o documento inteiro.
- Sem CORS, HTTPS, streaming ou uploads.
