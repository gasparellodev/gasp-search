# Site Irresistível — North Star

> **Epic transversal** que reúne 5 frentes coordenadas pra elevar os sites gerados pra Phase 7 ao patamar "cliente não consegue sustentar a tentação" e indexação perfeita em Google + AI search.

| Campo | Valor |
|---|---|
| Status | v1.1 — post-discovery (2026-05-17) — Frente 02 cancelada, Frente 05 reduzida |
| Criado | 2026-05-17 |
| Owner | Vinícius (GaspLab) |
| Specs filhas | `2026-05-17-site-irresistivel-01-competitive.md` · `-02-variations.md` · `-03-seo-infra.md` · `-04-geo-ai.md` · `-05-premium-pass.md` |
| Spec mestre Phase 7 | [`2026-05-08-gerador-sites-concessionarias-design.md`](./2026-05-08-gerador-sites-concessionarias-design.md) |
| Processo | [`PROCESS-multi-role-validation.md`](./PROCESS-multi-role-validation.md) |

---

## 1. Visão

> **Cada site gerado deve ser indistinguível de um trabalho boutique de R$ 30k+ feito por agência premium.** Deve ranquear top-3 no Google pra "concessionária <bairro>", aparecer citado em respostas do ChatGPT/Perplexity/AI Overviews, e ter taxa de contato ≥ 8% (vs ~2% de site genérico de concessionária).

### 1.1 Princípios diretores

1. **Variedade percebida.** Dois sites do gasp-search jamais devem parecer "irmãos óbvios". A variação vem de tema, foto, microcopy, layout asimétrico — não só de cor primária.
2. **SEO técnico irrepreensível.** Sitemap, schema, canonical, hreflang (quando aplicável), Core Web Vitals verde em P75 mobile. Zero erros no Search Console.
3. **GEO citável.** Conteúdo estruturado pra AI crawlers extraírem `business_name`, `address`, `phone`, FAQ, especialidades. `llms.txt` + `llms-full.txt` enxutos e bem formados.
4. **Conversão antes de estética.** Toda decisão visual passa pelo filtro "isso aumenta ou diminui WhatsApp clicks / form submits?".
5. **Sem dark patterns.** Sem countdown falso, sem "5 pessoas vendo agora", sem trial obscuro. Conversão por desejo, não por coerção.
6. **Acessibilidade não-negociável.** WCAG AA em todos os componentes; nenhum tema pode produzir contraste invisível. Fix do `wcagContrast()` em #342 é o padrão.

### 1.2 Anti-objetivos

- ❌ Construir CMS — leads não editam HTML; tudo via `lead_sites.variables` + manifest IA.
- ❌ Suportar idioma além de PT-BR no V1 (hreflang fica para V2 quando expandirmos pra hispanohablantes).
- ❌ Animações pesadas que pesem em LCP. Motion via `prefers-reduced-motion` aware, GPU-only.
- ❌ Tracking de terceiros além de GA4 (opt-in via LGPD banner). Sem Facebook Pixel/Hotjar no V1.

---

## 2. Decisões transversais já tomadas

Decisões aqui são **input** pras 5 sub-specs. Mudanças exigem PR no north-star com motivação.

### 2.1 Stack & runtime

- Next 16 App Router + Turbopack, Server Components por padrão.
- Tailwind v4 CSS-first (`@theme inline`), dark mode via classe `.dark` no `<html>`.
- Componentes consomem cores via **CSS vars** injetadas pelo `<SitePage>` (`--site-primary`, `--site-text-on-primary`) com fallback `sanitizeHex()` em prop.
- Manifest IA (`lead_sites.visual_identity`) é fonte primária de imagens; `brand_assets.*_url` é fallback. Pattern estabelecido em #217.

### 2.2 Quality gates por issue (não-negociáveis)

Toda issue desta epic atravessa esta sequência. **Pular etapa = bloqueia merge.**

1. **PO refine AC** — confirma critérios testáveis. Bloqueia se ambíguo.
2. **`frontend-design:frontend-design`** — produz mockup/intent visual antes do dev codar. Output: descrição estrutural + tokens + comportamento. (Issues sem UI pulam esta etapa explicitamente no corpo.)
3. **`site-dev` implementa** — TDD em lógica (`lib/`, `app/api/`, server actions). UI tem testes funcionais via RTL + `toHaveStyle`/`toHaveAttribute`.
4. **`vercel:react-best-practices`** — audit obrigatório em qualquer PR que toque `.tsx`. Achados de `'use client'` desnecessário, key prop, memoization, a11y → bloqueiam.
5. **`site-qa`** — valida AC ponta-a-ponta no preview Vercel, edge cases (`prefers-reduced-motion`, viewport 320px, dark→light toggle, theme variation toggle), screenshots.
6. **`sentry-skills:code-review`** — review estrutural Sentry-style (design, naming, error handling, testing).
7. **`sentry-skills:security-review`** — RLS bypass, secret leaks no bundle, XSS via `dangerouslySetInnerHTML`, CSS injection, OWASP. Foco especial em rotas públicas (`/sites/<slug>/*`).
8. **Squash merge** com `Closes #N`.

### 2.3 Critérios de aceite transversais

Toda PR desta epic deve provar (no corpo do PR ou via CI):

- [ ] Lint zero warnings (`npm run lint`).
- [ ] Typecheck zero erros (`npx tsc --noEmit`).
- [ ] Coverage ≥ 80% lines/functions em código novo de `lib/sites/` e `app/sites/`.
- [ ] `npm run build` verde (não basta `npm test` + lint — vide `feedback_run_build_after_fix`).
- [ ] Lighthouse mobile ≥ 90 (performance, a11y, best-practices, SEO) na rota afetada — print no PR.
- [ ] CrUX LCP P75 ≤ 2.5s em mobile (mede via PageSpeed Insights API quando rota tem tráfego; senão Lighthouse lab).
- [ ] WCAG AA: contraste ≥ 4.5:1 pra texto normal, 3:1 pra texto large. Validar com `wcagContrast()` em CSS vars dinâmicas.
- [ ] CLAUDE.md da pasta tocada atualizado.

### 2.4 Variação de layout (3 temas iniciais)

Detalhe em `-02-variations.md`. Resumo:

| Theme ID | Vibe | Persona alvo | Imagens manifest |
|---|---|---|---|
| `cinematic-dark` | Showroom à noite, asimétrico, gradient mask | Premium/luxo, esportivos | hero noturno, low-key lighting |
| `editorial-light` | Magazine clean, tipografia generosa | Família, premium acessível (BMW/Volvo dealers) | hero diurno, sky/lifestyle |
| `showroom-minimal` | Tesla-like, branco quase puro, foco no carro | Tech/elétricos, minimalistas | hero em fundo neutro, foto product |

Tema é resolvido em ordem: `lead_sites.theme_id` (override manual do user) → heurística (`brand_personality` + categorias de carro) → default `cinematic-dark`.

### 2.5 Stack de skills/agents oficial pra esta epic

| Skill/Agent | Quando |
|---|---|
| `superpowers:brainstorming` | Início de cada sub-spec (já feito) |
| `superpowers:writing-plans` | Após aprovação do north-star, vira plano executável |
| `frontend-design:frontend-design` | Antes de implementar qualquer UI |
| `vercel:react-best-practices` | Após implementar UI, antes do code-review |
| `vercel:shadcn` | Quando adicionar/modificar componente shadcn |
| `vercel:performance-optimizer` | Issues de #03 SEO Infra que mexem em LCP/CLS |
| `seo-schema` · `seo-technical` · `seo-geo` · `seo-sitemap` · `seo-page` | Validação automática nas frentes 3 e 4 |
| `seo-content` | Validação E-E-A-T nas páginas com conteúdo (Sobre, FAQ) |
| `site-po` · `site-dev` · `site-qa` · `site-reviewer` | Workflow multi-papel (alias dos agents Phase 7) |
| `sentry-skills:code-review` · `sentry-skills:security-review` | Review final antes do merge |
| `superpowers:verification-before-completion` | Antes de marcar issue como done |

---

## 3. Estrutura das 5 frentes

### Frente 01 — Competitive Analysis (Discovery)

- **Objetivo:** Mapear 8-12 concessionárias premium BR + 4 marketplaces (Kavak, Webmotors, InstaCarro, MeuCarroNovo) e produzir heurísticas concretas (microcopy patterns, layout devices, conversion CTAs) pras outras 4 frentes consumirem.
- **Duração estimada:** 3-5 dias.
- **Output:** `docs/research/2026-05-competitor-audit.md` + apêndice de screenshots + tabela de scores em 6 eixos (visual, conversion, SEO, performance, GEO, trust).
- **Bloqueia:** decisões finais de #02 (variations) e #05 (premium pass).
- **Pode rodar em paralelo com:** #03 (SEO infra é técnica, não depende de research).

### Frente 02 — Layout Variations

- **Objetivo:** Implementar 3 temas (`cinematic-dark` / `editorial-light` / `showroom-minimal`) com isolamento por componente, fallback gracioso, e seletor no admin GaspLab.
- **Duração estimada:** 8-12 dias.
- **Output:** `lead_sites.theme_id` column, `lib/sites/themes/*`, refator dos componentes pra theme-aware, admin UI pra escolher tema, testes visuais por tema.
- **Bloqueia:** rollout do #05 premium pass (premium pass deve cobrir os 3 temas).
- **Depende de:** #01 competitive (define qual vibe é mais valorada por qual persona).

### Frente 03 — SEO Infra

- **Objetivo:** Sitemap global dos sites, schema completo (LocalBusiness + AutoDealer + Vehicle + FAQPage + BreadcrumbList), canonical robusto, IndexNow polish, internal linking automation.
- **Duração estimada:** 6-8 dias.
- **Output:** `app/sites/sitemap.ts` (global) + `app/sites/[slug]/sitemap.ts` (per-site), schema helpers em `lib/sites/schema/*`, IndexNow batching, breadcrumb component.
- **Não bloqueia:** ninguém. Pode rodar 100% em paralelo.

### Frente 04 — GEO / AI Search

- **Objetivo:** `llms.txt` enriquecido (passage-citable), `llms-full.txt`, FAQ density, AICitableHero polish, brand mention coverage.
- **Duração estimada:** 4-6 dias.
- **Output:** `lib/sites/llms.ts` v2, `app/sites/[slug]/llms-full.txt/route.ts`, FAQ generator IA-assisted, dataset de mentions pra checagem mensal.
- **Depende de:** #03 (schema cobre parte da semântica que llms.txt referencia).

### Frente 05 — Premium Pass

- **Objetivo:** Auditoria visual + react-best-practices + microcopy por página. Home, Estoque, Estoque/[car], Sobre, Contato, Anunciar.
- **Duração estimada:** 12-18 dias (a mais longa).
- **Output:** PRs incrementais por página, cada um com print before/after, vitest funcionais, schema validado.
- **Depende de:** #01 (heurísticas) + #02 (temas finalizados pra testar em todos) + #03 (schema infra disponível).

---

## 4. Cronograma proposto

```
Semana 1 (2026-05-17 → 2026-05-23)
├─ Frente 01 (Competitive) ──── 5d
└─ Frente 03 (SEO Infra) ──── 5d (paralelo)

Semana 2 (2026-05-24 → 2026-05-30)
├─ Frente 02 (Variations) iniciado ──── 5d
├─ Frente 03 (SEO Infra) finalizado ──── 3d
└─ Frente 04 (GEO) iniciado ──── 2d (após #03 fechar)

Semana 3 (2026-05-31 → 2026-06-06)
├─ Frente 02 (Variations) finalizada ──── 5d
├─ Frente 04 (GEO) finalizada ──── 3d
└─ Frente 05 (Premium Pass) iniciada ──── 3d

Semana 4-5 (2026-06-07 → 2026-06-20)
└─ Frente 05 (Premium Pass) ──── 10-14d (uma página por vez)
```

Total: **~5 semanas** com 1 dev em paralelo, **~3 semanas** com 2-3 devs.

---

## 5. Métricas de sucesso da epic

Medir 30 dias após merge da última PR:

| Métrica | Baseline (hoje) | Meta |
|---|---|---|
| Lighthouse mobile (P75 sites publicados) | ~75 perf | ≥ 90 perf, ≥ 95 SEO, ≥ 95 a11y |
| CrUX LCP P75 mobile | desconhecido | ≤ 2.5s |
| CrUX INP P75 mobile | desconhecido | ≤ 200ms |
| Search Console: erros estruturais | sitemap não envia | 0 erros, 0 warnings rich results |
| AI citations (Perplexity + ChatGPT) "concessionária <bairro>" | 0 | ≥ 1 site GaspLab citado em 5 queries amostrais |
| Conversion: WhatsApp click rate | ~2% | ≥ 8% (medido via `data-evt="whatsapp_click"`) |
| Conversion: contact form submit | ~1% | ≥ 4% |
| Visual variety subjective: blind test "estes 2 sites são do mesmo provedor?" | ~90% sim | ≤ 40% sim com os 3 temas |

---

## 6. Riscos & mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Variation system explode complexidade dos componentes | Alta | Theme via tokens (CSS vars + map JSON) — não múltiplas árvores de componentes. 1 componente serve 3 temas. |
| Manifest IA gera imagens inconsistentes entre temas | Média | Prompts de gen incluem `theme_id` desde #217.v2. Cache invalidation por troca de tema. |
| Lighthouse cai com adição de schema/scripts | Média | Schema é estático (JSON-LD inline server-rendered), zero JS extra. CWV gate por PR. |
| SEO penalty por "thin content" em sites sem estoque | Alta | Página Home sempre tem ≥ 500 palavras de texto único IA-gerado. FAQ ≥ 8 perguntas. Sobre ≥ 300 palavras. (`seo-content` valida.) |
| AI citations não acontecem orgânicamente | Média | llms.txt + structured data são pré-requisito, não garantia. Métrica monitorada via spot-checks mensais, não SLA. |
| Theme switch quebra preview/cache | Média | `cacheTag('site:<slug>')` invalidação cobre. Adicionar teste de regression em `tests/e2e/`. |

---

## 7. Glossário rápido

- **Lead** — usuário GaspLab (concessionária) dono de um `lead_sites` row.
- **Site público** — `/sites/<slug>/*`, renderizado pra cliente final do lead (comprador de carro).
- **Theme** — variação visual (`cinematic-dark` etc.) aplicada a um site.
- **Manifest IA** — `lead_sites.visual_identity` JSON com 9 URLs de imagens geradas.
- **Variables** — `lead_sites.variables` JSON com textos/dados do site (validado por `SiteVariables` Zod).
- **GEO** — Generative Engine Optimization (otimização pra AI search).
- **Passage citability** — propriedade de um trecho de texto ser extraível por LLM com atribuição clara.

---

## 8. Como evoluir este documento

- Aprovação inicial pelo Vinícius → freeze v1.0.
- Cada sub-spec referencia este pelo path relativo. Mudança aqui requer atualizar sub-specs afetadas no mesmo PR.
- Decisões transversais novas viram `DECISION-<slug>.md` em `docs/superpowers/decisions/` se forem grandes; entradas pequenas vão pro `§2` deste doc com timestamp.
- Após conclusão da epic, mover pra `docs/superpowers/specs/archive/`.
