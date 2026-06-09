# Deploy do WebChat no Amazon EKS

Este guia publica as imagens no Amazon ECR e implanta os manifests da pasta
`k8s/` em um cluster Amazon EKS com nós EC2 gerenciados.

Os comandos abaixo usam PowerShell.

## Arquitetura na AWS

```text
Internet
   |
AWS Load Balancer
   |
Frontend / Nginx
   |-- /api ------> API Gateway
   `-- /socket.io -> WebSocket Service

API Gateway -> Auth Service -> PostgreSQL / Redis
API Gateway -> Chat Service -> PostgreSQL / RabbitMQ
RabbitMQ -> WebSocket Service -> Redis Adapter
```

O procedimento mantém PostgreSQL, Redis e RabbitMQ dentro do Kubernetes para
facilitar o deploy acadêmico. Para produção, prefira Amazon RDS for PostgreSQL,
Amazon ElastiCache e Amazon MQ.

## 1. Pré-requisitos

Instale e configure:

- Docker Desktop
- AWS CLI v2
- `kubectl`
- `eksctl`
- Helm
- Uma conta AWS com permissões para EKS, EC2, IAM, ECR e CloudFormation

Valide as ferramentas:

```powershell
aws --version
kubectl version --client
eksctl version
helm version
docker version
aws sts get-caller-identity
```

Configure as variáveis usadas no restante do guia:

```powershell
$REGION = "us-east-1"
$CLUSTER = "webchat"
$IMAGE_TAG = "v1"
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$ECR = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
```

Use tags imutáveis, como o SHA do commit, em entregas reais:

```powershell
$IMAGE_TAG = (git rev-parse --short HEAD)
```

## 2. Construir as imagens

Na raiz do projeto:

```powershell
docker compose build
docker images --format "table {{.Repository}}`t{{.Tag}}`t{{.Size}}" webchat-*
```

Imagens locais esperadas:

```text
webchat-auth-service
webchat-chat-service
webchat-websocket-service
webchat-api-gateway
webchat-frontend
```

## 3. Criar os repositórios no ECR

```powershell
$SERVICES = @(
  "auth-service",
  "chat-service",
  "websocket-service",
  "api-gateway",
  "frontend"
)

foreach ($SERVICE in $SERVICES) {
  aws ecr describe-repositories `
    --region $REGION `
    --repository-names "webchat/$SERVICE" 2>$null

  if ($LASTEXITCODE -ne 0) {
    aws ecr create-repository `
      --region $REGION `
      --repository-name "webchat/$SERVICE" `
      --image-scanning-configuration scanOnPush=true
  }
}
```

Autentique o Docker. O token do ECR é temporário:

```powershell
aws ecr get-login-password --region $REGION |
  docker login --username AWS --password-stdin $ECR
```

## 4. Publicar as imagens

```powershell
$LOCAL_IMAGES = @{
  "auth-service"      = "webchat-auth-service:latest"
  "chat-service"      = "webchat-chat-service:latest"
  "websocket-service" = "webchat-websocket-service:latest"
  "api-gateway"       = "webchat-api-gateway:latest"
  "frontend"          = "webchat-frontend:latest"
}

foreach ($SERVICE in $LOCAL_IMAGES.Keys) {
  $REMOTE_IMAGE = "$ECR/webchat/${SERVICE}:$IMAGE_TAG"
  docker tag $LOCAL_IMAGES[$SERVICE] $REMOTE_IMAGE
  docker push $REMOTE_IMAGE
}
```

Confirme uma imagem publicada:

```powershell
aws ecr describe-images `
  --region $REGION `
  --repository-name webchat/frontend
```

## 5. Criar o cluster EKS

O comando abaixo cria VPC, sub-redes, control plane e um node group gerenciado.
Esses recursos geram cobrança enquanto existirem.

```powershell
eksctl create cluster `
  --name $CLUSTER `
  --region $REGION `
  --nodes 2 `
  --nodes-min 2 `
  --nodes-max 4 `
  --node-type t3.medium `
  --managed
```

Atualize o `kubeconfig` e valide o acesso:

```powershell
aws eks update-kubeconfig --region $REGION --name $CLUSTER
kubectl get nodes -o wide
kubectl get pods -A
```

## 6. Instalar o EBS CSI Driver

O PostgreSQL usa o PVC definido em `k8s/infrastructure.yaml`. O EBS CSI Driver
é responsável por provisionar o volume EBS.

Associe o provedor OIDC:

```powershell
eksctl utils associate-iam-oidc-provider `
  --region $REGION `
  --cluster $CLUSTER `
  --approve
```

Crie a role do driver:

```powershell
eksctl create iamserviceaccount `
  --name ebs-csi-controller-sa `
  --namespace kube-system `
  --cluster $CLUSTER `
  --region $REGION `
  --role-name AmazonEKS_EBS_CSI_DriverRole `
  --role-only `
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicyV2 `
  --approve
```

Instale o add-on:

```powershell
$EBS_ROLE_ARN = "arn:aws:iam::${ACCOUNT_ID}:role/AmazonEKS_EBS_CSI_DriverRole"

aws eks create-addon `
  --region $REGION `
  --cluster-name $CLUSTER `
  --addon-name aws-ebs-csi-driver `
  --service-account-role-arn $EBS_ROLE_ARN
```

Valide:

```powershell
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

Crie uma StorageClass `gp3` e marque-a como padrão:

```powershell
kubectl get storageclass -o name |
  ForEach-Object {
    kubectl annotate $_ storageclass.kubernetes.io/is-default-class- --overwrite
  }

@"
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
parameters:
  type: gp3
  encrypted: "true"
"@ | kubectl apply -f -
```

## 7. Instalar o AWS Load Balancer Controller

O Service público usa um Network Load Balancer gerenciado pelo controller.

Baixe a policy oficial da versão indicada pela documentação AWS:

```powershell
Invoke-WebRequest `
  -Uri "https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.14.1/docs/install/iam_policy.json" `
  -OutFile "iam_policy.json"

aws iam create-policy `
  --policy-name AWSLoadBalancerControllerIAMPolicy `
  --policy-document file://iam_policy.json
```

Se a policy já existir, o segundo comando retornará `EntityAlreadyExists` e
você pode continuar.

Crie a ServiceAccount com IRSA:

```powershell
eksctl create iamserviceaccount `
  --cluster $CLUSTER `
  --region $REGION `
  --namespace kube-system `
  --name aws-load-balancer-controller `
  --attach-policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy" `
  --override-existing-serviceaccounts `
  --approve
```

Instale o controller:

```powershell
helm repo add eks https://aws.github.io/eks-charts
helm repo update eks

helm upgrade --install aws-load-balancer-controller `
  eks/aws-load-balancer-controller `
  --namespace kube-system `
  --set clusterName=$CLUSTER `
  --set serviceAccount.create=false `
  --set serviceAccount.name=aws-load-balancer-controller `
  --version 1.14.0
```

Valide:

```powershell
kubectl rollout status `
  deployment/aws-load-balancer-controller `
  -n kube-system
```

Consulte a documentação oficial antes de um deploy futuro para confirmar se
há uma versão mais recente do controller e do chart.

## 8. Configurar ConfigMap e segredos

Não aplique os valores `change-me` presentes no exemplo.

Crie o namespace:

```powershell
kubectl create namespace webchat --dry-run=client -o yaml |
  kubectl apply -f -
```

Crie o ConfigMap:

```powershell
kubectl create configmap webchat-config `
  --namespace webchat `
  --from-literal=DB_HOST=postgres `
  --from-literal=DB_PORT=5432 `
  --from-literal=DB_NAME=webchat `
  --from-literal=DB_USER=webchat `
  --from-literal=DB_SYNC=true `
  --from-literal=REDIS_HOST=redis `
  --from-literal=REDIS_PORT=6379 `
  --from-literal=REDIS_URL=redis://redis:6379 `
  --from-literal=RABBITMQ_EXCHANGE=chat.events `
  --from-literal=RABBITMQ_QUEUE=websocket.message-events `
  --from-literal=AUTH_SERVICE_URL=http://auth-service:3000 `
  --from-literal=CHAT_SERVICE_URL=http://chat-service:3000 `
  --from-literal=CORS_ORIGIN=* `
  --dry-run=client `
  -o yaml |
  kubectl apply -f -
```

Crie o Secret com valores reais. Use uma senha URL-safe para o RabbitMQ,
pois ela fará parte de uma URL AMQP:

```powershell
$DB_PASSWORD = Read-Host "Senha do PostgreSQL"
$RABBITMQ_PASSWORD = Read-Host "Senha do RabbitMQ"
$JWT_SECRET = Read-Host "JWT secret com pelo menos 32 caracteres"

kubectl create secret generic webchat-secrets `
  --namespace webchat `
  --from-literal=DB_PASSWORD="$DB_PASSWORD" `
  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" `
  --from-literal=RABBITMQ_USER="webchat" `
  --from-literal=RABBITMQ_PASSWORD="$RABBITMQ_PASSWORD" `
  --from-literal=RABBITMQ_URL="amqp://webchat:${RABBITMQ_PASSWORD}@rabbitmq:5672" `
  --from-literal=JWT_SECRET="$JWT_SECRET" `
  --dry-run=client `
  -o yaml |
  kubectl apply -f -
```

Em produção, use AWS Secrets Manager com External Secrets Operator ou o
Secrets Store CSI Driver, em vez de segredos declarados em arquivos.

## 9. Implantar a infraestrutura

```powershell
kubectl apply -f k8s/infrastructure.yaml
kubectl get pods,pvc -n webchat
```

Aguarde PostgreSQL, Redis e RabbitMQ:

```powershell
kubectl wait `
  --namespace webchat `
  --for=condition=Available deployment/postgres deployment/redis deployment/rabbitmq `
  --timeout=10m
```

Confirme que o PVC ficou `Bound`:

```powershell
kubectl get pvc -n webchat
```

Se continuar `Pending`, verifique:

```powershell
kubectl describe pvc postgres-data -n webchat
kubectl get storageclass
kubectl get pods -n kube-system | Select-String ebs
```

## 10. Implantar a aplicação

Primeiro aplique os Deployments e Services:

```powershell
kubectl apply -f k8s/applications.yaml
```

Troque as imagens de exemplo pelas imagens do ECR:

```powershell
kubectl set image deployment/auth-service `
  auth-service="$ECR/webchat/auth-service:$IMAGE_TAG" -n webchat

kubectl set image deployment/chat-service `
  chat-service="$ECR/webchat/chat-service:$IMAGE_TAG" -n webchat

kubectl set image deployment/websocket-service `
  websocket-service="$ECR/webchat/websocket-service:$IMAGE_TAG" -n webchat

kubectl set image deployment/api-gateway `
  api-gateway="$ECR/webchat/api-gateway:$IMAGE_TAG" -n webchat

kubectl set image deployment/frontend `
  frontend="$ECR/webchat/frontend:$IMAGE_TAG" -n webchat
```

Configure o Service público para um Network Load Balancer:

```powershell
kubectl annotate service frontend `
  -n webchat `
  service.beta.kubernetes.io/aws-load-balancer-type=external `
  service.beta.kubernetes.io/aws-load-balancer-nlb-target-type=ip `
  service.beta.kubernetes.io/aws-load-balancer-scheme=internet-facing `
  --overwrite
```

## 11. Validar o deploy

```powershell
kubectl get pods,services,deployments -n webchat
kubectl rollout status deployment/auth-service -n webchat
kubectl rollout status deployment/chat-service -n webchat
kubectl rollout status deployment/websocket-service -n webchat
kubectl rollout status deployment/api-gateway -n webchat
kubectl rollout status deployment/frontend -n webchat
```

Obtenha o endereço público:

```powershell
kubectl get service frontend -n webchat -w
```

Quando `EXTERNAL-IP` mostrar um hostname AWS, abra:

```text
http://<EXTERNAL-IP>
```

O provisionamento do Load Balancer pode levar alguns minutos.

## 12. Diagnóstico

Logs:

```powershell
kubectl logs deployment/api-gateway -n webchat --tail=200
kubectl logs deployment/auth-service -n webchat --tail=200
kubectl logs deployment/chat-service -n webchat --tail=200
kubectl logs deployment/websocket-service -n webchat --tail=200
kubectl logs deployment/frontend -n webchat --tail=200
```

Eventos e descrição de Pods:

```powershell
kubectl get events -n webchat --sort-by=.metadata.creationTimestamp
kubectl describe pod <POD_NAME> -n webchat
```

Teste temporário sem Load Balancer:

```powershell
kubectl port-forward service/frontend 8080:80 -n webchat
```

Depois acesse `http://localhost:8080`.

## 13. Atualizar a aplicação

Construa e publique uma tag nova:

```powershell
$IMAGE_TAG = (git rev-parse --short HEAD)
docker compose build
```

Repita o tag/push da seção 4 e atualize cada Deployment com
`kubectl set image`. Acompanhe:

```powershell
kubectl rollout status deployment/frontend -n webchat
kubectl rollout history deployment/frontend -n webchat
```

Rollback:

```powershell
kubectl rollout undo deployment/frontend -n webchat
```

## 14. HTTPS e domínio

Para produção:

1. Registre ou configure o domínio no Route 53.
2. Emita um certificado no AWS Certificate Manager na mesma região.
3. Instale o AWS Load Balancer Controller.
4. Troque a exposição direta do Service por um Ingress ALB com HTTPS.
5. Redirecione HTTP para HTTPS.

O ALB suporta tráfego HTTP e WebSocket. O certificado deve ser referenciado
pela annotation `alb.ingress.kubernetes.io/certificate-arn`.

## 15. Remover os recursos

Apague o cluster quando não estiver em uso para interromper a maior parte da
cobrança:

```powershell
kubectl delete namespace webchat
eksctl delete cluster --name $CLUSTER --region $REGION
```

Os repositórios ECR não são removidos pelo `eksctl`:

```powershell
foreach ($SERVICE in $SERVICES) {
  aws ecr delete-repository `
    --region $REGION `
    --repository-name "webchat/$SERVICE" `
    --force
}
```

Confira também volumes EBS, Load Balancers, snapshots, endereços IP e recursos
do CloudFormation que possam ter permanecido.

## Referências oficiais

- [Criar cluster EKS com eksctl](https://docs.aws.amazon.com/eks/latest/userguide/getting-started-eksctl.html)
- [Conectar kubectl ao EKS](https://docs.aws.amazon.com/eks/latest/userguide/create-kubeconfig.html)
- [Publicar imagens no Amazon ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html)
- [EBS CSI Driver no EKS](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
- [AWS Load Balancer Controller](https://docs.aws.amazon.com/eks/latest/userguide/lbc-helm.html)
- [Application Load Balancer com EKS](https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html)
