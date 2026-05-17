# `lib/seo/` — SEO Integrations

## Propósito

Helpers server-only para integrações SEO externas que não pertencem ao domínio
de render dos sites (`lib/sites/`).

## Regras

- Não logar PII. URLs públicas dos mini-sites são permitidas; payloads internos
  de `lead_sites.variables` não são.
- Falhas de provedores externos devem degradar com `console.warn` e nunca
  bloquear mutations de usuário.
- Testes ficam em `tests/unit/lib/seo/`.

## Arquivos

| Path | Propósito |
|---|---|
| `indexnow.ts` | `notifyIndexNow(urls)` — deduplica URLs, agrupa por host, envia batches de até 10 URLs para IndexNow/Bing/Yandex/Naver. `INDEXNOW_KEY` é opcional em build; sem key vira no-op com warning. |
| `indexnow-queue.ts` | **#367.** `enqueueIndexNow(url)` + `flushIndexNowQueue()` — fila singleton por processo que coalece mutations rápidas (ex: upload em lote de 20 carros) em 1-2 POSTs IndexNow em vez de N. Auto-flush por tamanho (≥10 URLs) ou tempo (10s). Best-effort: erros de flush são `console.warn`, nunca bloqueiam o caller. `__resetIndexNowQueueForTests()` para reset em testes. |
