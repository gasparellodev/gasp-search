/**
 * `app/sites/[slug]/llms.txt/route.ts` — Route handler que serve o
 * `llms.txt` consumido por AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, Gemini etc.) para citation grounding em AI Overviews
 * e respostas AI search.
 *
 * Issue #214 / Sprint 1 / #S4 — fecha o ciclo GEO da Phase 7.
 *
 * Fonte canônica: `docs/SEO-PLAN.md` §Sprint 1 #S4 + PO refinement na
 * issue #214.
 *
 * **Decisões PO refinement (#214):**
 *
 * 1. **Gate `isIndexable` → 404 text/plain**. Llms.txt expõe contato
 *    comercial direto (telefone, WhatsApp, endereço da loja); vazar
 *    em site `draft`/`archived`/sem `signed_at` quebra privacy by
 *    obscurity. Distinto do JSON-LD em `#211` que SEMPRE injeta (lá
 *    é só metadata schema, sem contato direto). Igual ao `#213` OG
 *    image gate.
 *
 * 2. **404 com `Content-Type: text/plain; charset=utf-8`** em TODOS os
 *    paths de erro. `notFound()` default emite HTML — AI crawlers
 *    parseariam errado. Usamos `Response` manual com header explícito.
 *
 * 3. **Cache via `export const revalidate = 3600` + invalidação
 *    transitiva por `getSite()`**. NÃO usamos `"use cache"` directive:
 *    Route Handlers que retornam `Response` (built-in com prototype
 *    não-plain) crasham quando atravessam o cache boundary
 *    serializável do Next 16 ("Only plain objects ... can be passed
 *    to Client Components"). Também NÃO chamamos `cacheTag` no
 *    handler — Next 16 exige `cacheTag` DENTRO de `"use cache"`,
 *    senão `Error: 'cacheTag()' can only be called inside a "use cache"
 *    function`. A invalidação flui via `getSite()` que internamente
 *    tem `"use cache"` + `cacheTag('site:<slug>')`. Os 5 callsites
 *    de `updateTag('site:<slug>')` em `app/actions/lead-site.ts`
 *    (após `updateLeadSite`, `publishLeadSite`, `archiveLeadSite`,
 *    `restoreLeadSite`, `signLeadSite`) expiram o cache de `getSite`,
 *    e o `revalidate = 3600` do handler regenera a Response na
 *    próxima request. Padrão alinhado com `opengraph-image.tsx` (#213).
 *
 * 4. **`safeParse` falha → 404 text/plain** (defesa em profundidade).
 *    `lead_sites.variables` é `unknown` no banco; quando o payload
 *    está malformado, não tentamos renderizar parcial.
 *
 * **Privacy/logging:** zero PII nos logs do server. `slug` é seguro
 * (público). `business_name`, telefone, email NÃO entram em
 * `console.warn`/`error`.
 *
 * **Cache-Control header**: redundante com Next cache directives mas
 * explícito pra proxies/CDNs externos (CloudFlare, etc.).
 *   - `max-age=3600` — browser cache 1h.
 *   - `s-maxage=3600` — CDN cache 1h.
 *   - `stale-while-revalidate=86400` — serve stale por 24h enquanto
 *     revalida (alinha com `cacheLife({ revalidate: 3600, expire: 86400 })`
 *     do `getSite`).
 */
import "server-only";

import { getSite } from "@/lib/sites/get-site";
import { renderLlmsTxt } from "@/lib/sites/llms";
import { isIndexable } from "@/lib/sites/metadata";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * ISR 1h via Next Metadata file convention (mesmo padrão do
 * `opengraph-image.tsx` #213). `"use cache"` directive em Route
 * Handlers retornando `Response` quebra serialização no Next 16 —
 * o objeto `Response` (built-in com prototype não-plain) não pode
 * atravessar o cache boundary do React. Usamos `export const
 * revalidate = 3600` + `cacheTag` standalone dentro do handler
 * para invalidação via `updateTag('site:<slug>')`.
 */
export const revalidate = 3600;

/**
 * Cabeçalhos compartilhados para todas as respostas — 200 e 404 ambas
 * `text/plain; charset=utf-8` por consistência com AI crawler parsing.
 *
 * Mantemos `Cache-Control` apenas nas respostas 200 (404 não deve ser
 * cacheada agressivamente em CDN — site pode ser publicado/assinado a
 * qualquer momento).
 */
const TEXT_PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
} as const;

/**
 * Resposta 404 padronizada — body curto, Content-Type text/plain.
 */
function notFoundTextPlain(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: TEXT_PLAIN_HEADERS,
  });
}

/**
 * GET handler. Async — `await params` é mandatório no Next 16.
 */
export async function GET(
  _req: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { slug } = await params;

  // Cache strategy: invalidation flui via `getSite()` que internamente
  // usa `"use cache"` + `cacheTag('site:<slug>')` (ver `lib/sites/get-site.ts`).
  // Os 5 callsites de `updateTag('site:<slug>')` em
  // `app/actions/lead-site.ts` (update/publish/archive/restore/sign)
  // expiram o cache de `getSite`, e o `revalidate = 3600` do route
  // handler regenera a Response na próxima request.
  //
  // NÃO chamamos `cacheTag(\`site:\${slug}\`)` no escopo do handler:
  // Next 16 exige que `cacheTag` esteja DENTRO de `"use cache"` (que
  // não podemos usar aqui — Route Handlers retornando `Response`
  // crasham o cache boundary, "Only plain objects ... can be passed
  // to Client Components"). Manter `cacheTag` fora dispara
  // `Error: 'cacheTag()' can only be called inside a "use cache" function`.
  const site = await getSite(slug);

  // Gate 1: site inexistente → 404 text/plain.
  if (site === null) {
    return notFoundTextPlain();
  }

  // Gate 2: site não-indexável (draft/archived/sem signed_at) → 404.
  // Distinto do JSON-LD que SEMPRE injeta — llms.txt expõe contato direto
  // e seguimos privacy-by-obscurity igual ao OG image (#213).
  if (!isIndexable(site)) {
    return notFoundTextPlain();
  }

  // Gate 3: payload `variables` malformado → 404 (defesa em profundidade).
  // Não tentamos renderizar parcial — AI crawler caching de payload
  // quebrado seria pior que 404.
  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    return notFoundTextPlain();
  }

  const body = renderLlmsTxt({ variables: parsed.data, slug });

  return new Response(body, {
    status: 200,
    headers: {
      ...TEXT_PLAIN_HEADERS,
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
