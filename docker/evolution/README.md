# Evolution API — dev local

Container Docker que expõe a [Evolution API](https://github.com/EvolutionAPI/evolution-api) (wrapper open-source de WhatsApp). Usado pela Phase 5 do gasp-search para envio e recebimento de mensagens WhatsApp.

> **Produção:** este compose é apenas para desenvolvimento local. Em produção, suba o Evolution em VPS dedicada e aponte `EVOLUTION_API_URL` do gasp-search para a URL pública dela. A feature flag `NEXT_PUBLIC_WHATSAPP_ENABLED=0` (default) mantém a UI desligada até a infra estar pronta.

## Pré-requisitos

- Docker + Docker Compose v2
- [ngrok](https://ngrok.com/) (para receber webhooks do Evolution durante o dev)

## Setup (dev local)

1. **Copie e preencha o `.env`:**

   ```bash
   cp docker/evolution/.env.example docker/evolution/.env
   ```

   Preencha:
   - `AUTHENTICATION_API_KEY` — escolha um valor forte (32+ chars). Esse é o mesmo valor que vai em `EVOLUTION_API_KEY` no `.env.local` da raiz do projeto.
   - `POSTGRES_PASSWORD` — senha do Postgres interno do Evolution (qualquer valor forte).
   - `WEBHOOK_GLOBAL_URL` — preencha **depois** do passo 4 com a URL do ngrok.

2. **Suba os containers:**

   ```bash
   docker compose -f docker/evolution/docker-compose.yml up -d
   ```

   Ou, dentro da pasta:

   ```bash
   cd docker/evolution
   docker compose up -d
   ```

3. **Verifique que está rodando:**

   ```bash
   curl http://localhost:8080
   # Deve responder com {"status":200,"message":"Welcome to the Evolution API ..."}
   ```

4. **Suba o ngrok apontando pro gasp-search local:**

   ```bash
   ngrok http 3000
   ```

   Copie a URL `https://...ngrok.io` e cole em `WEBHOOK_GLOBAL_URL` no `.env`, com sufixo `/api/whatsapp/webhook`. Exemplo:

   ```
   WEBHOOK_GLOBAL_URL=https://abc123.ngrok.io/api/whatsapp/webhook
   ```

   Recrie o container para pegar a nova env:

   ```bash
   docker compose up -d --force-recreate evolution
   ```

5. **Configure o `.env.local` da raiz do projeto:**

   ```env
   EVOLUTION_API_URL=http://localhost:8080
   EVOLUTION_API_KEY=<o-mesmo-AUTHENTICATION_API_KEY>
   EVOLUTION_WEBHOOK_SECRET=<um-secret-forte-min-16-chars>
   NEXT_PUBLIC_WHATSAPP_ENABLED=1
   ```

6. **Reinicie o `npm run dev`** para o Next pegar as novas envs.

## Comandos úteis

```bash
# Ver logs do Evolution
docker compose -f docker/evolution/docker-compose.yml logs -f evolution

# Parar tudo
docker compose -f docker/evolution/docker-compose.yml down

# Parar e DELETAR todas as instâncias (reset completo)
docker compose -f docker/evolution/docker-compose.yml down -v
```

## Troubleshooting

- **Evolution não responde em `http://localhost:8080`**: rode `docker compose logs evolution` e procure por erros do Postgres/Redis. Os healthchecks garantem que o Evolution só sobe quando os serviços de dependência estão prontos.
- **Webhook não chega no gasp-search**: confirme que (a) ngrok está rodando, (b) `WEBHOOK_GLOBAL_URL` aponta pra URL pública dele com `/api/whatsapp/webhook` no final, (c) você recriou o container do Evolution após mudar a env.
- **"Forbidden" / 401 do Evolution**: cheque que `EVOLUTION_API_KEY` no `.env.local` é exatamente igual a `AUTHENTICATION_API_KEY` no `docker/evolution/.env`.

## Volumes

Os dados persistem em volumes Docker nomeados (não em bind mounts no projeto):

- `gasp-evolution_evolution_instances` — sessões WhatsApp pareadas
- `gasp-evolution_evolution_postgres_data` — Postgres do Evolution
- `gasp-evolution_evolution_redis_data` — cache Redis

Para resetar tudo: `docker compose down -v`.
