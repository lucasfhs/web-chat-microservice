# Kubernetes

Os manifests usam imagens locais com os nomes `webchat/<servico>:latest`.
Antes de aplicar, publique essas imagens no registry do cluster ou altere os
campos `image`.

Troque todos os valores de `k8s/namespace-config.yaml` marcados como
`change-me` e aplique na ordem:

```bash
kubectl apply -f k8s/namespace-config.yaml
kubectl apply -f k8s/infrastructure.yaml
kubectl apply -f k8s/applications.yaml
```

O unico servico externo e o `frontend`. O Nginx encaminha `/api` para o API
Gateway e `/socket.io` para o WebSocket Service. Os demais Services sao
internos ao namespace.

Para producao, use um operador ou servico gerenciado para PostgreSQL,
RabbitMQ e Redis, armazene segredos fora dos manifests e substitua
`DB_SYNC=true` por migrations.
