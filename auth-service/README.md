# Auth Service

Microsservico de autenticacao em NestJS para cadastro, login, logout,
validacao de JWT e revogacao de tokens via Redis.

## Executar com Docker

Use o `docker-compose.yml` da raiz do workspace. Copie a `.env.example` raiz,
troque `JWT_SECRET` e inicie os containers:

```bash
docker compose up --build
```

O servico fica disponivel em `http://localhost:3000`.

## Executar localmente

PostgreSQL e Redis devem estar acessiveis conforme o arquivo `.env`.

```bash
npm install
npm run start:dev
```

## Endpoints

### `POST /auth/register`

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "strong-password"
}
```

### `POST /auth/login`

```json
{
  "email": "ada@example.com",
  "password": "strong-password"
}
```

Retorna um `accessToken` JWT e o tipo `Bearer`.

### `POST /auth/logout`

Requer `Authorization: Bearer <token>`. Responde com status `204` e inclui o
hash SHA-256 do token na blacklist do Redis ate o instante `exp` do JWT.

### `GET /auth/validate`

Requer `Authorization: Bearer <token>`. Verifica assinatura, expiracao,
blacklist e existencia do usuario, retornando `id`, `name`, `email` e
`createdAt`.

## Decisoes arquiteturais

- `AuthModule` concentra credenciais e emissao/validacao de JWT.
- `UsersModule` isola a persistencia Sequelize do modelo `User`.
- `RedisModule` e global e possui apenas operacoes da blacklist.
- O token bruto nao e armazenado; a chave Redis usa SHA-256 e TTL restante.
- Configuracoes sao validadas no startup e nao existem hosts fixos no codigo.
- `DB_SYNC=true` facilita a execucao academica. Em producao, use
  `DB_SYNC=false` e migrations Sequelize.
- O guard consulta Redis e PostgreSQL. O WebChat compartilha apenas o segredo
  de assinatura e nao acessa usuarios nem Redis.
