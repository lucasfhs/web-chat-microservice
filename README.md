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

## Unitários

Cobrir:

* Auth Service
* Chat Service

## Integração

Cobrir:

* Gateway → Auth
* Gateway → Chat
* Chat → RabbitMQ
* RabbitMQ → WebSocket

## Carga

Simular:

* 10 usuários simultâneos
* Login simultâneo
* Troca de mensagens simultânea

