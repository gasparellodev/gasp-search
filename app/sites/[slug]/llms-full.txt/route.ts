/**
 * `app/sites/[slug]/llms-full.txt/route.ts` — Route handler que serve o
 * `llms-full.txt` consumido por AI crawlers para citation grounding
 * expandida (ChatGPT, Claude, Perplexity, AI Overviews).
 *
 * Issue #G2 / Frente 04 GEO/AI.
 *
 * **Diferença vs `llms.txt`:**
 *   - Inventário expandido: até 20 carros (vs 6 no `llms.txt`).
 *   - Seção "Sobre" com `about_text` + `mission` + `vision` completos.
 *   - FAQ completo (FAQ_TEMPLATE 8 Q&As).
 *   - Truncation automática quando output > 32k chars.
 *
 * **Padrão idêntico ao `llms.txt/route.ts`:**
 *   - Gate `isIndexable` → 404 text/plain.
 *   - Content-Type: text/plain; charset=utf-8.
 *   - Cache via `export const revalidate = 3600` + invalidação transitiva
 *     por `getSite()` (mesma estratégia do `llms.txt`).
 *   - `safeParse` falha → 404 (defesa em profundidade).
 *
 * **Decisões PO (#G2):**
 * 1. **Gate `isIndexable`** idêntico ao `llms.txt`. Llms-full.txt expõe
 *    contato comercial e dados do negócio — mesmo critério de privacy.
 * 2. **Sem `"use cache"` directive** — Route Handlers retornando `Response`
 *    crasham o cache boundary do Next 16. Mesma razão do `llms.txt`.
 * 3. **`revalidate = 3600`** — ISR 1h, consistente com `llms.txt` e
 *    `opengraph-image.tsx`.
 * 4. **Cache-Control header** redundante mas explícito para CDNs externos.
 *
 * **Privacy/logging:** zero PII nos logs. `slug` é seguro (público).
 */
import "server-only";

import { getSite } from "@/lib/sites/get-site";
import { renderLlmsFullTxt } from "@/lib/sites/llms";
import { isIndexable } from "@/lib/sites/metadata";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * ISR 1h via Next Metadata file convention — mesmo padrão do `llms.txt`
 * route handler e do `opengraph-image.tsx` (#213).
 */
export const revalidate = 3600;

/**
 * Cabeçalhos compartilhados para todas as respostas — `text/plain; charset=utf-8`
 * por consistência com AI crawler parsing.
 */
const TEXT_PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
} as const;

/**
 * Resposta 404 padronizada — body curto, Content-Type text/plain.
 * AI crawlers não parseariam HTML de 404 corretamente.
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

  // Cache strategy: invalidação flui via `getSite()` que internamente
  // usa `"use cache"` + `cacheTag('site:<slug>')` (ver `lib/sites/get-site.ts`).
  // Os 5 callsites de `updateTag('site:<slug>')` em `app/actions/lead-site.ts`
  // expiram o cache de `getSite`, e o `revalidate = 3600` do route handler
  // regenera a Response na próxima request.
  const site = await getSite(slug);

  // Gate 1: site inexistente → 404 text/plain.
  if (site === null) {
    return notFoundTextPlain();
  }

  // Gate 2: site não-indexável (draft/archived/sem signed_at) → 404.
  // Llms-full.txt expõe dados completos do negócio — mesmo critério
  // de privacy do llms.txt e OG image (#213).
  if (!isIndexable(site)) {
    return notFoundTextPlain();
  }

  // Gate 3: payload `variables` malformado → 404 (defesa em profundidade).
  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    return notFoundTextPlain();
  }

  const body = renderLlmsFullTxt({ variables: parsed.data, slug });

  return new Response(body, {
    status: 200,
    headers: {
      ...TEXT_PLAIN_HEADERS,
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
