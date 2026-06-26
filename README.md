# Chat Distribuído

Projeto desenvolvido para a disciplina de Sistemas Distribuídos.

## Objetivo

Desenvolver uma plataforma de comunicação em tempo real baseada em microsserviços, capaz de suportar:

* Autenticação de usuários
* Conversas privadas (1:1)
* Conversas em grupo (1:N)
* Comunicação em tempo real via WebSocket
* Persistência de mensagens
* Escalabilidade horizontal
* Arquitetura distribuída baseada em eventos

---

# Arquitetura do Projeto

```text
chat-distribuido/

├── frontend/
│
├── api-gateway/
│
├── auth-service/
│
├── chat-service/
│
├── websocket-service/
│
├── docker-compose.yml
│
└── README.md
```

---

# Diagrama da Arquitetura

```mermaid
flowchart LR

    Front[Frontend]

    AG[API Gateway]

    AUTH[Auth Service]
    CHAT[Chat Service]
    WS[WebSocket Service]

    MQ[(RabbitMQ)]

    PG[(PostgreSQL)]
    REDIS[(Redis)]

    Front --> AG

    AG --> AUTH
    AG --> CHAT

    AUTH --> PG
    AUTH --> REDIS

    CHAT --> PG

    CHAT --> MQ

    MQ --> WS

    WS <-->|WebSocket| Front
```

---

# Tecnologias

## Frontend

* React
* TypeScript
* Socket.IO Client
* Axios

## Backend

* NestJS
* TypeScript

## Banco de Dados

* PostgreSQL

## Cache

* Redis

## Mensageria

* RabbitMQ

## Containers

* Docker
* Docker Compose

---

# Responsabilidades dos Serviços

## Frontend

Responsável por:

* Login
* Cadastro
* Lista de conversas
* Envio de mensagens
* Recebimento de mensagens em tempo real

Não possui regra de negócio.

Toda comunicação deve ocorrer através do API Gateway.

---

## API Gateway

Responsável por:

* Receber requisições HTTP
* Validar JWT
* Encaminhar requisições para os microsserviços
* Centralizar autenticação

Não deve conter regra de negócio.

---

## Auth Service

Responsável por:

* Cadastro de usuários
* Login
* Refresh Token
* Validação de JWT
* Logout
* Revogação de Tokens

Recursos utilizados:

* PostgreSQL
* Redis

---

## Chat Service

Responsável por:

* Criar conversas
* Criar grupos
* Persistir mensagens
* Buscar histórico
* Gerenciar participantes

Após persistir uma mensagem deve publicar um evento no RabbitMQ.

Exemplo:

```json
{
  "event": "message.created",
  "chatId": "123",
  "senderId": "456",
  "content": "Olá mundo"
}
```

---

## WebSocket Service

Responsável por:

* Gerenciar conexões WebSocket
* Gerenciar salas
* Gerenciar usuários online
* Consumir eventos do RabbitMQ
* Entregar mensagens em tempo real

Não deve salvar dados diretamente no banco.

---

# Fluxo de Login

```text
Frontend
    ↓
API Gateway
    ↓
Auth Service
    ↓
PostgreSQL
```

Resposta:

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

---

# Fluxo de Mensagens

```text
Frontend
    ↓
API Gateway
    ↓
Chat Service
    ↓
PostgreSQL

Mensagem Persistida

Chat Service
    ↓
RabbitMQ
    ↓
WebSocket Service
    ↓
Frontend Destinatário
```

---

# Estrutura Inicial do Banco

## Users

```sql
id UUID PRIMARY KEY
username VARCHAR(50)
email VARCHAR(255)
password_hash TEXT
created_at TIMESTAMP
```

## Chats

```sql
id UUID PRIMARY KEY
name VARCHAR(255)
type VARCHAR(20)
created_at TIMESTAMP
```

## Chat Participants

```sql
chat_id UUID
user_id UUID
```

## Messages

```sql
id UUID PRIMARY KEY
chat_id UUID
sender_id UUID
content TEXT
created_at TIMESTAMP
```

---

# Eventos RabbitMQ

## message.created

Emitido quando uma mensagem é salva.

## user.online

Emitido quando usuário conecta.

## user.offline

Emitido quando usuário desconecta.

---

# Requisitos Funcionais

## Usuários

* Criar conta
* Fazer login
* Fazer logout

## Chat

* Conversa privada
* Conversa em grupo
* Histórico de mensagens

## Tempo Real

* Entrega instantânea
* Indicador de usuário online

---

# Testes

O projeto tem três níveis principais de teste:

* **Unitário**: valida uma classe ou serviço isolado, com dependências mockadas.
* **Integração/E2E**: valida o fluxo real entre frontend, API Gateway, serviços,
  banco, RabbitMQ, Redis e WebSocket.
* **Carga**: executa vários usuários e mensagens simultâneas para observar
  latência, entrega em tempo real e persistência.

## Pré-requisitos

Instale as dependências dos serviços que possuem testes e scripts:

```bash
cd auth-service
npm install

cd ../chat-service
npm install

cd ../frontend
npm install
```

Para os testes que usam a aplicação completa, suba a stack como normalmente:

```bash
cd ..
cp .env.example .env
docker compose up --build
```

Aguarde o frontend responder em `http://localhost:8080` antes de rodar os
testes de integração ou carga.

## Teste unitário

Os testes unitários ficam nos arquivos `*.spec.ts`. Atualmente existem testes
para:

* `auth-service/src/auth/auth.service.spec.ts`
* `chat-service/src/chat/chat.service.spec.ts`

Eles não precisam do Docker Compose ativo, porque usam mocks para banco, Redis,
RabbitMQ e outros serviços externos.

Execute cada serviço separadamente:

```bash
cd auth-service
npm test
```

```bash
cd chat-service
npm test
```

Para gerar cobertura no Auth Service:

```bash
cd auth-service
npm run test:cov
```

Para gerar cobertura no Chat Service:

```bash
cd chat-service
npm run test:cov
```

Como escrever novos testes unitários:

* Crie arquivos `*.spec.ts` ao lado da classe testada.
* Use mocks para dependências externas, como Sequelize, Redis, RabbitMQ e HTTP.
* Teste regras de negócio isoladas, por exemplo credenciais inválidas, criação
  de grupo sem nome, usuário sem permissão e publicação correta de evento.

## Teste de integração/E2E

O teste de integração disponível valida o fluxo completo de grupo em tempo real:

* cadastro e login de usuários;
* validação do token pelo Gateway/Auth;
* criação de grupo pelo Chat Service;
* eventos em tempo real via WebSocket;
* publicação/consumo de eventos pelo RabbitMQ;
* recibos de leitura;
* remoção de participante;
* persistência e consulta de histórico.

Com o Docker Compose ativo, rode:

```bash
cd frontend
npm run test:e2e:realtime
```

Por padrão esse script usa:

* `E2E_API_URL=http://localhost:8080/api`
* `E2E_WS_URL=http://localhost:8080/realtime`

Caso precise apontar para outro ambiente:

```bash
E2E_API_URL=http://localhost:8080/api E2E_WS_URL=http://localhost:8080/realtime npm run test:e2e:realtime
```

No PowerShell:

```powershell
$env:E2E_API_URL="http://localhost:8080/api"
$env:E2E_WS_URL="http://localhost:8080/realtime"
npm run test:e2e:realtime
```

O teste passa quando o terminal mostra:

```text
Realtime group E2E passed
```

## Teste de carga

O teste de carga cria usuários, faz logins simultâneos, abre conexões WebSocket,
cria um grupo e envia mensagens em paralelo. Ao final, ele mostra métricas de
latência HTTP, taxa de requisições, entregas em tempo real e mensagens
persistidas.

Com o Docker Compose ativo, rode:

```bash
cd frontend
LOAD_API_URL=http://localhost:8080/api LOAD_WS_URL=http://localhost:8080/realtime npm run test:load
```

No PowerShell:

```powershell
cd frontend
$env:LOAD_API_URL="http://localhost:8080/api"
$env:LOAD_WS_URL="http://localhost:8080/realtime"
npm run test:load
```

Por padrão o script simula 10 usuários e 5 mensagens por usuário. Para alterar
a carga:

```bash
LOAD_API_URL=http://localhost:8080/api LOAD_WS_URL=http://localhost:8080/realtime LOAD_USERS=25 LOAD_MESSAGES=10 npm run test:load
```

No PowerShell:

```powershell
$env:LOAD_API_URL="http://localhost:8080/api"
$env:LOAD_WS_URL="http://localhost:8080/realtime"
$env:LOAD_USERS="25"
$env:LOAD_MESSAGES="10"
npm run test:load
```

O teste passa quando o terminal mostra:

```text
RESULT: PASS
```

Se o teste falhar por timeout, confirme se todos os containers estão saudáveis:

```bash
docker compose ps
```

E acompanhe os logs:

```bash
docker compose logs -f api-gateway auth-service chat-service websocket-service rabbitmq
```

---

# Executar o Projeto

Crie o arquivo de ambiente e altere os segredos:

```bash
cp .env.example .env
docker compose up --build
```

Aplicação: `http://localhost:8080`

RabbitMQ Management: `http://localhost:15672`

O Nginx do frontend encaminha `/api` ao API Gateway e `/socket.io` ao
WebSocket Service. Auth, Chat, PostgreSQL, Redis e RabbitMQ não precisam ser
expostos publicamente.

## API pública

* `POST /api/auth/register`
* `POST /api/auth/login`
* `POST /api/auth/logout`
* `GET /api/auth/validate`
* `GET /api/auth/users`
* `GET /api/chats`
* `POST /api/chats`
* `GET /api/chats/:chatId/messages`
* `POST /api/chats/:chatId/messages`
* `POST /api/chats/:chatId/participants`
* `DELETE /api/chats/:chatId/participants/:participantId`
* `POST /api/chats/:chatId/read`

As rotas de chat são autenticadas pelo Gateway. O Gateway valida o token no
Auth Service e injeta a identidade do usuário nas chamadas internas.

O criador de um grupo é seu administrador. Apenas ele pode adicionar e
remover membros. Leituras são persistidas por mensagem e distribuídas em
tempo real.

## Eventos em tempo real

* `message.created`
* `message.read`
* `chat.created`
* `participant.added`
* `participant.removed`

Com a stack Docker ativa, o fluxo completo de grupos pode ser validado com:

```bash
cd frontend
npm run test:e2e:realtime
```

## Kubernetes

Os manifests iniciais estão em `k8s/`. Eles incluem Services internos,
probes, ConfigMap, Secret, persistência do PostgreSQL e duas réplicas para o
Gateway, WebSocket Service e frontend.

Para instalar e executar o ambiente Kubernetes localmente no Windows com
Docker Desktop, incluindo escala manual e HPA, consulte
[`KUBERNETES_LOCAL.md`](KUBERNETES_LOCAL.md).

Para uma visão resumida dos manifests, consulte `k8s/README.md`.

Para publicar as imagens no ECR e fazer o deploy no Amazon EKS, consulte
`DEPLOY_AWS_EKS.md`.


# Trabalho Futuro

* Replicação de Banco
* Balanceamento de Carga
* Notificações Push
* Upload de Arquivos
* Criptografia ponta a ponta

