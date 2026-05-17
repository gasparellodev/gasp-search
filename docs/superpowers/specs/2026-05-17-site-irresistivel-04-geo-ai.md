# Frente 04 — GEO / AI Search

> Sub-spec de [`site-irresistivel-northstar.md`](./2026-05-17-site-irresistivel-northstar.md). Objetivo: maximizar **citações em AI search** (ChatGPT, Perplexity, Google AI Overviews, Claude, Gemini).

| Campo | Valor |
|---|---|
| Status | Draft |
| Tipo | Feature multi-issue (conteúdo + infra) |
| Duração estimada | 4-6 dias úteis |
| Depende de | #03 SEO Infra (schema cobre semântica que llms.txt e AI extractors usam) |
| Bloqueia | nada |

---

## 1. Problema

Estado atual GEO:

| Componente | Estado |
|---|---|
| `robots.ts` AI bot allowlist | ✅ 11 bots + Bingbot |
| `app/sites/[slug]/llms.txt/route.ts` | ⚠️ Existe mas formato minimal — pouco extraível |
| `llms-full.txt` | ❌ Ausente |
| `<AICitableHero>` | ✅ Existe (PR #211) |
| Brand mention coverage | ❌ Nunca medido |
| FAQ density | ⚠️ `<SiteFAQ>` opcional, sem mínimo |
| Passage citability | ❌ Não auditado |
| Sentence-level structure | ⚠️ Microcopy não otimizado pra AI extraction |

AI search responde "concessionária em São Paulo zona sul" extraindo passages de páginas com:
1. **Endereço + telefone próximos** (atribuição clara).
2. **Headlines curtas e factuais** ("Vendemos BMW e Audi seminovos em Pinheiros").
3. **FAQ explícita** que casa com query intent.
4. **Schema markup** complementando o texto.
5. **llms.txt indicando o sumário** (cresceu como padrão em 2025-2026).

GaspLab faz 1+5 razoavelmente; precisa subir 2, 3, 4.

---

## 2. Objetivo

1. **`llms.txt` enriquecido** — formato `> # Title\n\nSummary\n\n## Section`, com seções `## Inventário`, `## Marcas`, `## Endereço`, `## Contato`, `## FAQ`. Tamanho-alvo 800-1500 tokens.
2. **`llms-full.txt`** — versão expandida com texto completo de Home + Sobre + FAQ, ≤ 8k tokens.
3. **FAQ density mínima** — ≥ 8 perguntas auto-geradas por IA + 4 opcionais do lead.
4. **Passage citability** — auditoria automática que cada parágrafo principal seja "extraível": tem sujeito explícito + fato + atribuição implícita ao negócio.
5. **Brand mention monitoring** — script que faz 10 queries amostrais em Perplexity API + ChatGPT scraper (DataForSEO) e mede aparições do site GaspLab.

---

## 3. Issues propostas

### #G1 — `llms.txt` v2 (passage-citable)

**AC:**
- [ ] `lib/sites/llms.ts` refatorada pra emitir formato estruturado:
  ```
  # <business_name>
  
  > <description curta 1-2 frases factual>
  
  ## Localização
  <address>
  <phone>
  <whatsapp>
  
  ## Especialidades
  - Marca: BMW, Audi, Mercedes
  - Tipo: Seminovos premium até 5 anos
  - Faixa de preço: R$ 80k a R$ 300k
  
  ## Inventário atual
  <N> veículos disponíveis. Veja em <url>/estoque
  
  ## Garantias
  - Garantia X meses motor/câmbio
  - Procedência checada por <provedor>
  
  ## FAQ
  ### Vocês aceitam carro na troca?
  Sim. <politica resumida>.
  
  ### Vocês financiam?
  <politica>
  
  ## Contato
  <email>
  <telefone>
  Atendimento: <horarios>
  ```
- [ ] Helper `lib/sites/llms.ts` testado com 3 fixtures (mínimo, completo, com FAQ).
- [ ] Cache: invalidação via `cacheTag('site:<slug>')` mantida.
- [ ] Defesa: campos textuais sanitizados — sem `</llms`, sem markdown injection.
- [ ] Snapshot test estabiliza formato.

**Skills:** TDD obrigatório. `seo-geo` valida estrutura final.

---

### #G2 — `llms-full.txt` route handler

**AC:**
- [ ] `app/sites/[slug]/llms-full.txt/route.ts` análogo ao `llms.txt`.
- [ ] Conteúdo: cabeçalho do `llms.txt` + texto completo Home + Sobre + lista de até 20 carros (nome, ano, km, preço) + FAQ completa.
- [ ] Tamanho-alvo ≤ 8000 tokens (~ 32k chars). Truncar listas se exceder.
- [ ] Mesmo gate `isIndexable` do `llms.txt`.
- [ ] Cache + Content-Type idênticos.

---

### #G3 — FAQ density mínima + auto-gen IA

**Problema:** `SiteVariables.faq` aceita 0..N; metade dos leads tem 0 FAQs.

**AC:**
- [ ] Server Action `generateFAQ(site_id)` chama Anthropic (`claude-sonnet-4-6`) com prompt que recebe `variables` + contexto da concessionária e gera 8 FAQs PT-BR.
- [ ] Schema Zod valida saída IA (`{question: string, answer: string}[]`).
- [ ] Botão "Gerar FAQ com IA" no admin GaspLab `(app)/sites/edit/[id]`.
- [ ] Auto-trigger no `signLeadSite` se `faq.length < 8`.
- [ ] Custos: cada call ~ $0.01. Logar custo em `lead_sites.ai_costs` (col existente? verificar; se não, adicionar).
- [ ] Coverage 100% no helper de prompt.

**Skills:** `claude-api` revisão prompt. TDD em helper. Anthropic key per `feedback_anthropic_key_phase7`.

---

### #G4 — `<AICitableHero>` polish + brand mention pattern

**Problema:** `<AICitableHero>` injeta dados mas o pattern de extração precisa de pareamento explícito.

**AC:**
- [ ] Componente refatorado pra emitir bloco `<address>` semântico com `itemprop` microdata redundante + JSON-LD.
- [ ] Adicionar `aria-label="Informações de contato da concessionária"` pro screen reader e crawler.
- [ ] Heading hierarchy: `<h1>` é business_name; `<h2>` "Sobre a <name>"; `<h3>` cada seção.
- [ ] Sentence pattern: cada parágrafo de hero começa com `<business_name>` como sujeito ("A <name> vende seminovos premium em <bairro>").
- [ ] Validado por `seo-geo` (passage citability heurística).

---

### #G5 — Brand mention monitoring script

**AC:**
- [ ] `scripts/geo-monitoring/run.ts` (Bun ou tsx) que:
  1. Carrega lista de leads publicados (`status IN ('published', 'sent')`).
  2. Para cada um, executa 5 queries amostrais ("concessionária <bairro>", "<marca> seminovos <cidade>", "onde comprar <modelo> em <cidade>") em Perplexity API + DataForSEO ChatGPT scraper.
  3. Salva resultados em `lead_sites_geo_monitoring` (nova tabela).
  4. Gera relatório markdown em `docs/geo-monitoring/YYYY-MM-DD-report.md`.
- [ ] Roda manualmente via `npm run geo:monitor` (V1) ou cron mensal (V2 — issue futura).
- [ ] Output: tabela com lead_id × query × cited (boolean) × snippet × source (Perplexity/ChatGPT).
- [ ] Testes mocados de API.

**Skills:** `seo-dataforseo` (ChatGPT scraper já disponível via MCP), `claude-api` (Perplexity client opcional ou direto via REST).

---

### #G6 — Microcopy patterns pra passage citability

**Problema:** Hero, About, FAQ atuais têm linguagem genérica ("a melhor experiência em compra de veículos") — não citável.

**AC:**
- [ ] `lib/sites/microcopy/passage-patterns.md` documenta 10 patterns concretos:
  - "A <name> é uma concessionária de <tipo> localizada em <bairro>, <cidade>." (intro factual)
  - "Trabalhamos com <marcas-lista>." (especialidades explícitas)
  - "Nosso estoque tem <N> veículos com preços entre <min> e <max>." (numbers grounded)
  - "Estamos abertos <horários>." (operações)
  - ...
- [ ] Prompt generator IA (em `lib/sites/ai-generation/`) refatorado pra produzir textos seguindo estes patterns.
- [ ] Validação E-E-A-T via `seo-content` em PRs que mudem o prompt.
- [ ] Sites re-gerados absorvem patterns sem migração de dados (re-gen acontece no próximo `regenerate-site`).

**Skills:** `seo-content`, `seo-geo`, `claude-api`.

---

### #G7 — `app/sites/[slug]/.well-known/ai-policy.json` (opcional, future-proof)

**AC:**
- [ ] Route handler emite JSON com policy de uso AI conforme proposta IETF (2025-2026):
  ```json
  {
    "policy": "open",
    "training_allowed": true,
    "citation_required": true,
    "contact": "<email>"
  }
  ```
- [ ] Skip se draft/archived.
- [ ] Cache + Content-Type `application/json`.
- [ ] Testes.

**NB:** Padrão ainda não consolidado; implementar é hedge barato. Pular se #03 atrasar.

---

### #G8 — Documentação GEO + dashboard

**AC:**
- [ ] `docs/SEO-PLAN.md` ganha seção GEO atualizada.
- [ ] `lib/sites/CLAUDE.md` documenta llms / llms-full convention.
- [ ] Dashboard interno `(app)/admin/geo-health/page.tsx` opcional (mostra resultado do #G5 script).

---

## 4. Critérios de saída

- [ ] 8 issues fechadas.
- [ ] `llms.txt` validado em ≥ 3 sites (curl + manual review).
- [ ] `llms-full.txt` ≤ 8k tokens em sites com 50+ carros.
- [ ] FAQ ≥ 8 perguntas em todo site publicado novo.
- [ ] Brand mention script rodado 1×, baseline documentado.
- [ ] `seo-geo` audit passa com score ≥ 80/100 em ≥ 3 sites.

---

## 5. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| FAQ gerada por IA tem hallucination (inventa serviço que lead não oferece) | Prompt restringe a usar APENAS dados de `variables`; output passa por validação humana antes de publish; AC inclui "PO valida FAQ amostral em #G3" |
| `llms-full.txt` excede 8k tokens em sites grandes | Truncamento + nota "<lista parcial; veja /estoque/sitemap.xml pra completa>" |
| Perplexity API muda esquema/preço | Wrapper isolado em `lib/geo/perplexity.ts`; fácil trocar pra DataForSEO-only |
| Sites genéricos não conseguem subir score GEO sem conteúdo único | Frente 05 Premium Pass injeta conteúdo único por página; aceito como dependência reverse |
| AI bots ignoram `llms.txt` | Hedge: schema (#03) cobre 80% da semântica independente de llms.txt |

---

## 6. Fora de escopo (V2+)

- Pluggable LLM providers (V1 = Anthropic only).
- Real-time brand mention alerts (V1 = script manual).
- llms.txt internacional (V1 = PT-BR only).
- Custom AI policy per lead (V1 = policy global "open").
