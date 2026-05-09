/**
 * Rota pública dinâmica `/sites/[slug]` (issue #160 + refactor #163).
 *
 * Fonte canônica: §8 do spec mestre
 * (`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`).
 *
 * Renderiza o site personalizado de um lead a partir do slug global único
 * (`lead_sites.slug`). Usa Next 16 Cache Components (`'use cache'` +
 * `cacheTag` + `cacheLife`) via `getSite()` em `lib/sites/get-site.ts`
 * para servir a 2ª request em diante do edge cache. Invalidação acontece
 * via `updateTag(\`site:\${slug}\`)` em `app/actions/lead-site.ts` (M1.7).
 *
 * **Refactor #163**: `getSite` foi extraído pra `lib/sites/get-site.ts`
 * — comportamento idêntico, agora reutilizável pelas sub-rotas
 * `/sobre`, `/contato`, `/anunciar`. Esta rota mantém os mesmos testes
 * em `tests/unit/app/sites/page.test.tsx`.
 *
 * **Routing por status** (per spec §4 + issue #160 AC1):
 *   - `null` (slug inexistente) → `notFound()` → 404.
 *   - `draft` → `notFound()` → 404 (site ainda não publicado).
 *   - `archived` → `notFound()` → 404 (V1; spec pede 410 — TODO V2 via
 *     route handler dedicado quando o time priorizar).
 *   - `published` → renderiza `<SitePage>`.
 *   - `sent` → renderiza `<SitePage>` (mesma view; difere só na ficha
 *     interna do lead).
 *
 * **Defesa em profundidade**: `SiteVariables.safeParse(...)` antes de
 * passar pra `<SitePage>`. Se a IA gravou JSON quebrado em
 * `lead_sites.variables`, o componente nunca recebe dados malformados —
 * page cai em `notFound()` em vez de quebrar o React rendering.
 *
 * **`noindex`**: `metadata.robots = { index: false, follow: false }` —
 * site público de lead não deve aparecer em SERP. Hardening adicional
 * (`X-Robots-Tag` header) fica para V2.
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SitePage } from "@/components/sites/SitePage";
import { getSite } from "@/lib/sites/get-site";
import { SiteVariables } from "@/types/lead-site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();

  // `draft` e `archived` ambos viram 404 no V1.
  // TODO(V2 — site-generator): retornar 410 Gone para `archived` via
  // middleware customizado ou rota dedicada `/sites/[slug]/gone`
  // redirecionada com status 410. Per spec §4 (linha 192).
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  // Defesa em profundidade — validação Zod antes do render.
  // Se a IA gravou JSON quebrado em `variables`, NÃO crashamos React;
  // tratamos como recurso ausente.
  const parsed = SiteVariables.safeParse(site.variables);
  if (!parsed.success) {
    // Log estruturado sem PII (apenas slug + paths das issues do Zod).
    // Importante: nunca logar `variables` cru — pode conter `business_name`,
    // `email`, etc.
    console.error("[site:render] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  return <SitePage variables={parsed.data} siteId={site.id} slug={site.slug} />;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
