# Executar o WebChat localmente com Kubernetes

Este guia mostra como instalar e configurar um cluster Kubernetes local no
Windows, publicar o projeto nesse cluster e aumentar ou reduzir as replicas dos
servicos.

O caminho recomendado para este projeto e o Kubernetes integrado ao Docker
Desktop. Ele evita a necessidade de instalar Minikube, Kind ou Helm
separadamente.

## 1. O que sera executado

```text
Navegador
   |
Frontend / Nginx
   |-- /api ------> API Gateway
   `-- /socket.io -> WebSocket Service

API Gateway -> Auth Service -> PostgreSQL / Redis
API Gateway -> Chat Service -> PostgreSQL / RabbitMQ
RabbitMQ -> WebSocket Service -> Redis Adapter
```

Os manifests existentes em `k8s/` criam:

- um namespace chamado `webchat`;
- PostgreSQL, Redis e RabbitMQ;
- Auth Service, Chat Service, WebSocket Service e API Gateway;
- o frontend Nginx;
- Services internos, probes de saude e um volume persistente para PostgreSQL.

## 2. Requisitos da maquina

Recomendado:

- Windows 10/11 com virtualizacao habilitada;
- WSL 2;
- Docker Desktop;
- pelo menos 8 GB de RAM disponivel para Docker Desktop;
- PowerShell;
- Git.

Este projeto usa cinco imagens proprias e tres componentes de infraestrutura.
Com pouca memoria, pods podem ficar em `Pending`, reiniciar ou ser encerrados
com `OOMKilled`.

## 3. Instalar Docker Desktop e kubectl

Instale o Docker Desktop:

<https://docs.docker.com/desktop/setup/install/windows-install/>

Durante a instalacao, use o backend WSL 2. Reinicie o Windows se o instalador
solicitar.

O Docker Desktop instala o `kubectl`. Caso seja necessario instala-lo
separadamente:

```powershell
winget install -e --id Kubernetes.kubectl
```

Valide:

```powershell
docker version
kubectl version --client
```

## 4. Criar o cluster local

1. Abra o Docker Desktop.
2. Entre na tela **Kubernetes**.
3. Selecione **Create cluster**.
4. Escolha **Kubeadm**, com um unico node, para este ambiente local.
5. Aguarde o status do Kubernetes ficar verde.

Confirme o contexto e o node:

```powershell
kubectl config get-contexts
kubectl config use-context docker-desktop
kubectl cluster-info
kubectl get nodes
```

O node deve aparecer como `Ready`.

Se o contexto `docker-desktop` nao existir, o cluster ainda nao foi criado ou
nao terminou de iniciar.

## 5. Construir as imagens do projeto

Execute na raiz do repositorio:

```powershell
docker build -t webchat/auth-service:latest ./auth-service
docker build -t webchat/chat-service:latest ./chat-service
docker build -t webchat/websocket-service:latest ./websocket-service
docker build -t webchat/api-gateway:latest ./api-gateway
docker build -f ./frontend/dockerfile `
  --build-arg VITE_API_URL=/api `
  --build-arg VITE_WS_URL=/realtime `
  -t webchat/frontend:latest ./frontend
```

Confirme:

```powershell
docker images "webchat/*"
```

Os nomes precisam ser exatamente os usados em `k8s/applications.yaml`:

```text
webchat/auth-service:latest
webchat/chat-service:latest
webchat/websocket-service:latest
webchat/api-gateway:latest
webchat/frontend:latest
```

O `imagePullPolicy: IfNotPresent` permite usar essas imagens locais no cluster
Kubeadm do Docker Desktop.

## 6. Criar configuracao e segredos

Primeiro aplique o namespace e a configuracao inicial:

```powershell
kubectl apply -f ./k8s/namespace-config.yaml
```

O arquivo versionado possui valores `change-me`. Substitua o Secret do cluster
por valores locais antes de iniciar os servicos:

```powershell
$DB_PASSWORD = [guid]::NewGuid().ToString("N")
$RABBITMQ_PASSWORD = [guid]::NewGuid().ToString("N")
$JWT_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$RABBITMQ_URL = "amqp://webchat:$RABBITMQ_PASSWORD@rabbitmq:5672"

kubectl create secret generic webchat-secrets `
  --namespace webchat `
  --from-literal=DB_PASSWORD="$DB_PASSWORD" `
  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" `
  --from-literal=RABBITMQ_USER="webchat" `
  --from-literal=RABBITMQ_PASSWORD="$RABBITMQ_PASSWORD" `
  --from-literal=RABBITMQ_URL="$RABBITMQ_URL" `
  --from-literal=JWT_SECRET="$JWT_SECRET" `
  --dry-run=client -o yaml | kubectl apply -f -
```

Esses valores existem apenas no cluster atual. Nao grave senhas reais no Git.

## 7. Fazer o deploy

Suba primeiro a infraestrutura:

```powershell
kubectl apply -f ./k8s/infrastructure.yaml
kubectl wait --namespace webchat `
  --for=condition=Available deployment/postgres deployment/redis deployment/rabbitmq `
  --timeout=180s
```

Depois suba a aplicacao:

```powershell
kubectl apply -f ./k8s/applications.yaml
kubectl wait --namespace webchat `
  --for=condition=Available `
  deployment/auth-service `
  deployment/chat-service `
  deployment/websocket-service `
  deployment/api-gateway `
  deployment/frontend `
  --timeout=300s
```

Verifique o resultado:

```powershell
kubectl get all -n webchat
kubectl get pods -n webchat -w
```

Use `Ctrl+C` para sair do modo de acompanhamento.

## 8. Abrir a aplicacao

O modo mais previsivel para acesso local e um port-forward:

```powershell
kubectl port-forward -n webchat service/frontend 8080:80
```

Mantenha esse terminal aberto e acesse:

<http://localhost:8080>

O Nginx encaminha `/api` para o API Gateway e `/socket.io` para o WebSocket
Service. Nao e necessario expor diretamente os microsservicos.

Para abrir a administracao do RabbitMQ em outro terminal:

```powershell
kubectl port-forward -n webchat service/rabbitmq 15672:15672
```

Depois acesse <http://localhost:15672> com o usuario `webchat` e a senha
gerada em `$RABBITMQ_PASSWORD`, caso a mesma sessao do PowerShell ainda esteja
aberta.

## 9. Escalar manualmente um modulo

Servicos que podem ser replicados diretamente:

- `frontend`;
- `api-gateway`;
- `auth-service`;
- `chat-service`;
- `websocket-service`.

Exemplo, aumentar o Chat Service para tres pods:

```powershell
kubectl scale deployment/chat-service -n webchat --replicas=3
kubectl rollout status deployment/chat-service -n webchat
kubectl get pods -n webchat -l app=chat-service -o wide
```

Outros exemplos:

```powershell
kubectl scale deployment/api-gateway -n webchat --replicas=3
kubectl scale deployment/websocket-service -n webchat --replicas=4
kubectl scale deployment/auth-service -n webchat --replicas=2
kubectl scale deployment/frontend -n webchat --replicas=2
```

Para reduzir novamente:

```powershell
kubectl scale deployment/chat-service -n webchat --replicas=1
```

O Service Kubernetes balanceia as requisicoes entre os pods correspondentes.
No WebSocket Service, o adapter Socket.IO/Redis compartilha salas e eventos
entre as replicas.

Atencao: um novo `kubectl apply -f ./k8s/applications.yaml` restaura o numero
de replicas declarado no YAML. Para tornar a alteracao permanente, edite
`spec.replicas` no Deployment correspondente.

## 10. O que nao deve ser escalado dessa forma

Nao execute simplesmente:

```powershell
kubectl scale deployment/postgres --replicas=3
kubectl scale deployment/redis --replicas=3
kubectl scale deployment/rabbitmq --replicas=3
```

Esses componentes mantem estado. Replicas corretas exigem configuracao de
cluster, identidade e armazenamento apropriados:

- PostgreSQL: operador, replicacao primaria/secundaria e estrategia de backup;
- Redis: Redis Sentinel, Redis Cluster ou servico gerenciado;
- RabbitMQ: RabbitMQ Cluster Operator e volumes por instancia.

Para desenvolvimento local, mantenha uma replica de cada um. Em producao,
prefira operadores Kubernetes ou servicos gerenciados.

## 11. Escala automatica com HPA

O Horizontal Pod Autoscaler precisa de:

- Metrics Server instalado no cluster;
- `resources.requests` definidos nos containers;
- carga suficiente para ultrapassar o limite configurado.

Instale o Metrics Server:

```powershell
kubectl apply -f `
  https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

kubectl rollout status deployment/metrics-server -n kube-system
kubectl top nodes
kubectl top pods -n webchat
```

Antes de criar o HPA, defina requests e limits. Exemplo para o API Gateway:

```powershell
kubectl set resources deployment/api-gateway -n webchat `
  --requests=cpu=100m,memory=128Mi `
  --limits=cpu=500m,memory=256Mi
```

Crie o HPA:

```powershell
kubectl autoscale deployment api-gateway -n webchat `
  --cpu-percent=60 `
  --min=2 `
  --max=6

kubectl get hpa -n webchat
kubectl describe hpa api-gateway -n webchat
```

Repita para outro servico stateless somente depois de medir requests e limits
adequados. Para remover:

```powershell
kubectl delete hpa api-gateway -n webchat
```

Evite editar `spec.replicas` manualmente enquanto um HPA controla o mesmo
Deployment.

## 12. Atualizar codigo e publicar uma nova imagem

Depois de alterar um servico, reconstrua sua imagem. Exemplo:

```powershell
docker build -t webchat/chat-service:latest ./chat-service
kubectl rollout restart deployment/chat-service -n webchat
kubectl rollout status deployment/chat-service -n webchat
```

Como a tag `latest` foi reutilizada, confirme que o cluster esta usando a
imagem nova. Em caso de cache:

```powershell
kubectl delete pod -n webchat -l app=chat-service
```

Para um fluxo mais confiavel, use tags diferentes:

```powershell
docker build -t webchat/chat-service:v2 ./chat-service
kubectl set image deployment/chat-service -n webchat `
  chat-service=webchat/chat-service:v2
kubectl rollout status deployment/chat-service -n webchat
```

## 13. Diagnostico

Visao geral:

```powershell
kubectl get pods -n webchat -o wide
kubectl get deployments,services,pvc -n webchat
kubectl get events -n webchat --sort-by=.lastTimestamp
```

Logs:

```powershell
kubectl logs -n webchat deployment/api-gateway --tail=200
kubectl logs -n webchat deployment/chat-service --tail=200
kubectl logs -n webchat deployment/websocket-service --tail=200
kubectl logs -n webchat deployment/auth-service --tail=200
```

Logs de todas as replicas de um modulo:

```powershell
kubectl logs -n webchat -l app=websocket-service `
  --all-containers=true `
  --prefix=true `
  --tail=200
```

Detalhes de um pod com falha:

```powershell
kubectl describe pod -n webchat NOME_DO_POD
```

Problemas comuns:

- `ImagePullBackOff`: a imagem nao existe com o nome esperado no Docker local;
- `CrashLoopBackOff`: consulte os logs e valide Secret, banco e mensageria;
- `Pending`: falta memoria/CPU ou o PVC nao foi provisionado;
- probe retornando erro: o servico iniciou, mas sua rota de saude nao respondeu;
- `kubectl` sem contexto: selecione `docker-desktop`;
- HPA com `<unknown>`: Metrics Server ou `resources.requests` estao ausentes.

## 14. Reiniciar ou remover o ambiente

Reiniciar um modulo:

```powershell
kubectl rollout restart deployment/websocket-service -n webchat
```

Remover apenas as aplicacoes:

```powershell
kubectl delete -f ./k8s/applications.yaml
```

Remover todo o namespace, incluindo o PVC e os dados locais do PostgreSQL:

```powershell
kubectl delete namespace webchat
```

Esse ultimo comando apaga os dados persistidos pelo projeto nesse cluster.

## 15. Limitacoes deste ambiente local

Este setup e adequado para desenvolvimento, demonstracao e testes de
replicacao dos microsservicos. Ele nao representa alta disponibilidade real:

- um cluster local de um node continua tendo um unico ponto de falha;
- PostgreSQL, Redis e RabbitMQ possuem uma replica;
- os Secrets ficam armazenados no cluster sem um gerenciador externo;
- `DB_SYNC=true` e conveniente localmente, mas producao deve usar migrations;
- a tag `latest` deve ser substituida por tags imutaveis em entregas reais.

Para deploy na AWS, consulte `DEPLOY_AWS_EKS.md`.

## Referencias oficiais

- Docker Desktop Kubernetes:
  <https://docs.docker.com/desktop/use-desktop/kubernetes/>
- Instalacao do kubectl no Windows:
  <https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/>
- Horizontal Pod Autoscaling:
  <https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/>
- Metrics Server:
  <https://github.com/kubernetes-sigs/metrics-server>
