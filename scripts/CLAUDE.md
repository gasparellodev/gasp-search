# `scripts/` — Spec Técnica

## Propósito

Scripts operacionais one-shot rodados via `npx tsx scripts/<name>.ts`.
Não fazem parte do bundle Next, não rodam em CI, não são testados (com
exceções pontuais — ver "Testes" abaixo).

Casos de uso: diagnóstico, backfill, seed de dados, validação manual,
disparo de pipelines caros (OpenAI/Apify) com cost gate humano.

## Como adicionar

- `npx tsx scripts/<name>.ts [args]` é o entry-point padrão.
- Sempre carregar `.env.local` via `config({ path: ".env.local" })` no
  topo do `main()`. Não tocar `process.env` antes disso.
- Service-role: `createClient(url, serviceKey, { auth: { persistSession: false } })`.
  Padrão estabelecido em `seed-poliguara.ts`.
- Scripts que escrevem em produção **devem** ter cost/safety gate
  interativo (readline y/N) e hard guard programático. Ex: cost cap
  em USD pra OpenAI antes do prompt.
- **Entry-point guard:** se o script exporta helpers reutilizáveis,
  envolver a chamada de `main()` em:
  ```ts
  import { fileURLToPath } from "node:url";
  const isDirectInvocation =
    process.argv[1] !== undefined &&
    process.argv[1] === fileURLToPath(import.meta.url);
  if (isDirectInvocation) main().catch(...);
  ```
  Isso evita que `import` em outro script dispare o `main()` indevidamente.

## Regras de negócio

1. **Service-role só roda manualmente.** Nunca expor no bundle do cliente,
   nunca chamar via API route sem auth.
2. **Cost gate é obrigatório** pra qualquer script que dispara OpenAI/Apify
   por nome de slug. `HARD_COST_CAP_USD = 2` é o teto V1 (igual à action
   `regenerateVisualIdentity`).
3. **Cache invalidation manual.** Scripts não conseguem invalidar o
   `cacheTag` do Next runtime — devem imprimir o `curl` pro
   `/api/dev/revalidate-site?slug=<slug>` no final.
4. **Sem PII em logs.** UUIDs (lead_id, user_id) são OK. Nunca logar
   `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, emails de leads.

## Arquivos

| Path | Propósito |
|---|---|
| `audit-all-pages.ts` | Audit funcional + visual das páginas dos sites publicados. |
| `clean-poliguara-placeholders.ts` | Substitui referências a `placehold.co` por `/assets/...` na row Poliguara. |
| `inspect-site-inventory.ts` | **Read-only.** `<slug>` → imprime `variables.cars[]` + overview do site (logo, address, has_visual_identity). Reusa `projectSiteRow` de `list-sites-needing-vi.ts`. |
| `list-sites-needing-vi.ts` | **Read-only.** Lista `lead_sites` com `visual_identity=null` + flags pra Google Maps logo / placeholder cars. Exporta `projectSiteRow(row): RowSummary` (pura, testada). |
| `measure-poliguara.ts` | Mede tempos de renderização do site Poliguara via Playwright. |
| `open-browser-poliguara.ts` | Abre o site Poliguara local em Playwright (smoke visual). |
| `parse-poliguara.ts` | Parse + dump do `variables` do site Poliguara. |
| `run-visual-identity.ts` | **Write (gated).** `<slug> [--force] [--dry-run]` → dispara pipeline `regenerateVisualIdentity` via service-role (bypassa `requireUser()` da action). Cost cap $2 USD + prompt interativo y/N. Persiste manifest em `lead_sites.visual_identity`. `--dry-run` imprime os prompts renderizados sem chamar OpenAI nem escrever no DB (útil quando precisa gerar imagens manualmente fora do pipeline). Exporta `assembleManifest({uploads, specs, estimate, model, generatedAt}): VisualIdentityManifest` (pura, testada). |
| `seed-poliguara.ts` | Seed/upsert `lead_sites` da Poliguara para validar UI premium. |
| `set-visual-identity.ts` | **Write (gated).** Alternativa ao runner OpenAI: sobe PNGs locais (já gerados manualmente em ChatGPT/Midjourney/etc) pro bucket `visual-identity/<slug>/*` e persiste o manifest. Uso: `npm run vi:set -- <slug> --hero=<path> --about=<path> --contact=<path> --category-<X>=<path> [--category-<Y>=<path>]`. Validações: hero/about/contact obrigatórios + ≥1 category; aceita as 6 categorias do `AssetVariant`. Modelo no manifest é fixado em `gpt-image-2-2026-04-21` (schema só aceita os 2 modelos pinados, indistinguível do output do pipeline). Exporta `parseSetArgs(argv)` (pura, testada). |
| `validate-ducarmo.ts` | Smoke Playwright headless do site Ducarmo após `vi:set` — verifica `visual-identity/<slug>/*` URLs renderizando, console limpo, flags pra `placehold.co` / `googleusercontent.com` (informativos). |
| `visual-review.ts` | **Headless Playwright QA visual.** `<slug> [--base=URL]` percorre Home/Sobre/Contato/Estoque/Anunciar em viewport desktop (1440×900) + mobile (390×844), salva screenshots full-page em `tmp/visual-review/<slug>/*.png` + `report.json`. Reporta: status, load ms, console errors/warnings, broken `<img>` (filtra SVG porque `naturalWidth=0` é falso-positivo do Playwright pra SVG ainda decodificando), `visual-identity` image count, `googleusercontent.com` visível como `<img>` (não JSON-LD), `placehold.co` no DOM, h1 count, tokens `--site-primary`/`--site-text-on-primary` resolvidos. Output usa `console.table` pro summary e linhas-resumo por rota. |
| `snap-contact.ts` | Snapshot Playwright da página de contato. |
| `validate-poliguara.ts` | Smoke E2E rápido do site Poliguara. |

## Testes

Helpers exportados de scripts (que outros scripts ou tests reusam) **devem**
ter cobertura em `tests/unit/scripts/<name>.test.ts`. Hoje:

- `projectSiteRow` em `list-sites-needing-vi.ts` (7 casos: clean, placeholder
  thumbnail, "Modelo N", "Ducarmo", Google Maps logo, null variables, v1
  flat shape).
- `assembleManifest` em `run-visual-identity.ts` (5 casos: 9-asset
  happy path, scrambled upload order, single-category Sedan-only,
  missing required variant, fallback model).
- `parseSetArgs` em `set-visual-identity.ts` (5 casos: slug + 4 paths,
  múltiplas categorias, missing slug, unknown flag, flag sem `=`).

I/O (Supabase, OpenAI, storage) **não é testado** aqui — já é testado
através das action tests em `tests/unit/app/actions/lead-site.test.ts` via
mocks. Replicar seria duplicação sem ganho.

## Dependências

- `tsx` (peer; via `npx`)
- `dotenv` (apenas pra `config({ path })`)
- `@supabase/supabase-js`
- `p-limit` (concurrency control em OpenAI calls)
- `node:readline/promises` + `node:url` (built-in)
