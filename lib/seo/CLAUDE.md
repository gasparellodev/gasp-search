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
