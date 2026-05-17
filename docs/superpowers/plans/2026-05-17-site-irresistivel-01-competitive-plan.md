# Site Irresistível — Frente 01 Competitive Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditar 15 sites de referência (8-12 concessionárias premium BR + 4 marketplaces BR + 3 US benchmarks) e produzir relatório com heurísticas concretas que alimentam Frentes 02, 04 e 05.

**Architecture:** Frente puramente de **discovery/pesquisa**. Sem código de produto. Output: arquivos markdown em `docs/research/` + screenshots PNG. Usa skills MCP (`seo-dataforseo`, `seo-visual`, `seo-technical`, `seo-schema`, `seo-geo`) + `WebFetch` + revisão manual.

**Tech Stack:** Skills do plugin claude-seo, Playwright (via `seo-visual`), DataForSEO MCP, PageSpeed Insights / CrUX (via `seo-google`).

**Spec:** [`docs/superpowers/specs/2026-05-17-site-irresistivel-01-competitive.md`](../specs/2026-05-17-site-irresistivel-01-competitive.md)

**Issues GitHub:** #C1-#C5 — milestone `Phase 7 — Irresistível 01 Competitive` (#9).

---

## File Structure

| Path | Responsibility |
|---|---|
| `docs/research/2026-05-competitor-audit.md` | **CREATE** — Relatório principal consolidado |
| `docs/research/audit-visual.md` | **CREATE** — Tabela scores visual + patterns |
| `docs/research/audit-seo.md` | **CREATE** — Tabela SEO/perf |
| `docs/research/audit-geo.md` | **CREATE** — Tabela GEO |
| `docs/research/screenshots/<slug>/*.png` | **CREATE** — 75 PNGs (15 sites × 5 cada) |

---

## Pre-flight Checklist

- [ ] Branch: `git checkout -b research/competitor-audit-2026-05`
- [ ] Diretório criado: `mkdir -p docs/research/screenshots`
- [ ] DataForSEO MCP server conectado (verificar com `claude mcp list` se aplicável)
- [ ] PageSpeed Insights API key configurada (per CLAUDE.md #233)
- [ ] Playwright instalado (`npx playwright install chromium`)
- [ ] WebFetch funcional

---

## Task 1: Definir lista final de 15 sites — #C1

**Files:**
- Create: `docs/research/2026-05-competitor-audit.md` (§1 só, restante incremental)

- [ ] **Step 1: Brainstorm candidatos via DataForSEO SERP**

Invocar a skill `seo-dataforseo` com query:

> "Quais são os top sites de concessionárias premium em São Paulo, Rio, BH e Curitiba? Quero rankings orgânicos para queries como 'concessionária premium', 'seminovos premium', 'BMW seminovos São Paulo', 'Audi seminovos', 'Porsche dealer Brasil'. Liste 15 URLs únicos."

Output esperado: lista de domínios candidatos com indicação de tráfego/ranking.

- [ ] **Step 2: Verificar acessibilidade dos candidatos**

Para cada URL candidato, invocar `WebFetch` com prompt mínimo (`"return title and h1 only"`). Descartar:
- Sites quebrados (4xx/5xx).
- Sites WordPress padrão sem customização visível.
- Sites com paywall ou bloqueio Cloudflare agressivo.

Manter os 12 melhores BR.

- [ ] **Step 3: Adicionar 4 marketplaces fixos**

- Kavak (kavak.com/br)
- Webmotors (webmotors.com.br)
- InstaCarro (instacarro.com)
- MeuCarroNovo (meucarronovo.com.br)

- [ ] **Step 4: Adicionar 3 US benchmarks fixos**

- Carvana (carvana.com)
- Vroom (vroom.com)
- 1 dealer Lexus boutique (e.g., lexusbeverlyhills.com — verificar via WebFetch que está ativo)

- [ ] **Step 5: Escrever §1 do relatório**

```markdown
# Auditoria competitiva — 2026-05

## §1. Sites auditados (15)

### Concessionárias premium BR (8)
| # | URL | Posicionamento | Por quê |
|---|---|---|---|
| 1 | https://... | Luxo BMW dealer SP | Top 3 SERP "BMW seminovos SP" |
| ... | ... | ... | ... |

### Seminovos premium independentes BR (4)
| 9-12 | ... | ... | ... |

### Marketplaces BR (4)
| 13 | https://kavak.com/br | Marketplace nacional | Default mental do comprador online |
| ... | ... | ... | ... |

### US benchmarks (3)
| 16-18 | ... | ... | Teto de qualidade visual + conversion |

### Critérios de exclusão
- Sites com tema WordPress padrão sem customização.
- Sites com paywall ou bloqueio anti-bot.
- Dealers oficiais OEM com layout idêntico ao corporativo (Toyota, Honda etc.) — incluído apenas 1 OEM/marca.
```

- [ ] **Step 6: Solicitar aprovação do PO**

Postar lista no PR docs ou enviar pro Vinícius via canal habitual. Aguardar OK antes de avançar pra Task 2.

- [ ] **Step 7: Commit**

```bash
git add docs/research/2026-05-competitor-audit.md
git commit -m "research(competitor): seleção inicial de 15 sites (#C1)"
```

---

## Task 2: Auditoria visual + conversion — #C2

**Files:**
- Create: `docs/research/audit-visual.md`
- Create: `docs/research/screenshots/<slug>/{hero-desktop,hero-mobile,estoque,car-detail,contato}.png` (75 arquivos)

- [ ] **Step 1: Capturar screenshots via `seo-visual` skill**

Pra cada URL, invocar `seo-visual` com prompt:

> "Capturar 5 screenshots: (1) hero desktop 1440×900, (2) hero mobile 375×812, (3) listagem de estoque desktop, (4) detalhe de um carro desktop, (5) página de contato desktop. Salvar como PNG em `docs/research/screenshots/<slug-derivado-do-domínio>/`."

Validar 75 PNGs criados (`find docs/research/screenshots -name "*.png" | wc -l` → 75).

- [ ] **Step 2: Avaliar cada site em 6 eixos (1-5)**

Para cada site, abrir os 5 screenshots + visitar o site. Pontuar:

| Eixo | Critério 5 | Critério 1 |
|---|---|---|
| Visual quality | Tipografia/spacing/cores premium, sem clichês | Tema default, baixa hierarquia |
| Conversion clarity | 1 CTA primary óbvio por viewport | CTAs múltiplos competindo |
| Microcopy quality | Texto contextual, personalidade | Lorem-ipsum-like genérico |
| Motion/animation | Choreographed, não disruptivo | Sliders/popups agressivos |
| Mobile parity | Mobile = desktop em qualidade | Mobile claramente afterthought |
| Trust signals | Avaliações reais, parceiros, garantia visível | Nenhum signal de credibilidade |

- [ ] **Step 3: Extrair top-3 patterns visuais por site**

Pra cada site, documentar 3 "devices" notáveis: como faz hero, como faz CTA, como faz gallery. Exemplo:
- "Carvana: Hero usa step indicator '3 steps to your car' em chips horizontais + foto product."
- "Kavak: TrustStrip animado com counter '40.000 carros vendidos' em scroll."

- [ ] **Step 4: Escrever `audit-visual.md`**

```markdown
# Auditoria visual + conversion

## Scores

| # | Site | Visual | Conversion | Microcopy | Motion | Mobile | Trust | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | ... | 4 | 5 | 3 | 4 | 5 | 4 | 25/30 |
| ... |

## Patterns extraídos

### Hero
1. **Cinematic dark + monogram** (BMW Dealer X): foto noturna asimétrica, logo bottom-right opacity 10%, headline sobre gradient mask.
2. **Editorial centrado** (Lexus Beverly): full-bleed lifestyle, headline serif 96pt, CTA único centrado.
3. ... (até 25)

### CTA
...

### Gallery
...
```

- [ ] **Step 5: Commit**

```bash
git add docs/research/audit-visual.md docs/research/screenshots/
git commit -m "research(competitor): auditoria visual + screenshots (#C2)"
```

---

## Task 3: Auditoria SEO + Schema + Performance — #C3

**Files:**
- Create: `docs/research/audit-seo.md`

- [ ] **Step 1: Pra cada URL, Lighthouse mobile**

Invocar `seo-google` ou `seo-page` com:

> "Rodar Lighthouse mobile na URL <X> e extrair scores: performance, SEO, accessibility, best practices. Também extrair CrUX field data se disponível (LCP P75, INP P75, CLS P75)."

Salvar resultado JSON em `docs/research/raw/lighthouse-<slug>.json`.

- [ ] **Step 2: Pra cada URL, Schema detection**

Invocar `seo-schema`:

> "Detectar todos os schema markup presentes em <URL>. Categorizar: LocalBusiness, AutoDealer, Vehicle, FAQPage, BreadcrumbList, Article, Product, Review, AggregateRating. Validar via Google Rich Results se possível."

- [ ] **Step 3: Pra cada URL, DataForSEO on-page audit**

Invocar `seo-dataforseo`:

> "On-page audit de <URL>: title/meta description quality, H1 presence, internal links count, image alt coverage, canonical correctness, robots.txt presence."

- [ ] **Step 4: Pra cada URL, internal linking depth + URL structure**

Invocar `seo-technical`:

> "Crawl <URL> com depth=2 e reportar: URL structure pattern, breadcrumb usage, internal links to depth 2 count, paginação rel=next/prev presence."

- [ ] **Step 5: Consolidar em `audit-seo.md`**

```markdown
# Auditoria SEO + Schema + Performance

## Lighthouse mobile (scores)

| # | Site | Perf | SEO | A11y | BP | LCP | INP | CLS |
|---|---|---|---|---|---|---|---|---|
| 1 | ... | 92 | 100 | 98 | 100 | 2.1s | 110ms | 0.04 |
| ... |

## Schema coverage

| # | Site | LocalBusiness | AutoDealer | Vehicle | FAQPage | Breadcrumb |
|---|---|---|---|---|---|---|
| 1 | ... | ✅ | ❌ | ✅ | ❌ | ✅ |
| ... |

## URL structure + internal linking

| # | Site | URL pattern | Avg internal links/page | rel=next/prev |
|---|---|---|---|---|
| ... |

## Gaps identificados (oportunidades pra GaspLab)

1. **70% dos concorrentes BR não têm schema Vehicle por carro** — GaspLab ranqueia rich snippet quando #S4 ficar pronto.
2. **45% não têm canonical absoluto** — duplicação por query string.
3. ...
```

- [ ] **Step 6: Commit**

```bash
git add docs/research/audit-seo.md docs/research/raw/
git commit -m "research(competitor): auditoria SEO + schema + perf (#C3)"
```

---

## Task 4: Auditoria GEO / AI Readiness — #C4

**Files:**
- Create: `docs/research/audit-geo.md`

- [ ] **Step 1: Pra cada URL, verificar `llms.txt` e `robots.txt`**

Invocar `seo-geo`:

> "Pra <URL>, verificar: existe `/llms.txt`? Existe `/llms-full.txt`? `/robots.txt` permite GPTBot, ClaudeBot, PerplexityBot? Quais AI bots tem explicit allow vs disallow?"

- [ ] **Step 2: Brand mention check (5 queries amostrais por site)**

Para cada site, definir 5 queries que o cliente real digitaria em ChatGPT/Perplexity:
- "concessionária <bairro principal do site>"
- "<marca> seminovos <cidade do site>"
- "onde comprar <modelo popular no estoque> em <cidade>"
- "loja de carros usados premium <cidade>"
- "<business_name>"

Invocar `seo-dataforseo` (AI visibility ChatGPT scraper):

> "Rodar query <Q> no scraper ChatGPT e reportar se <domínio> aparece citado, com qual snippet."

Repetir via Perplexity (manual ou WebFetch wrapper).

- [ ] **Step 3: Passage citability heurística**

Para cada site, pegar 5 trechos de texto (hero, sobre, FAQ, contato, garantia). Pontuar 1-5:
- 5 = trecho começa com `<business_name>`, contém fato verificável, formato declarativo.
- 1 = trecho é genérico, sem sujeito explícito, sem fato.

- [ ] **Step 4: AI Overviews coverage**

Para 3 queries amostrais por site, ranquear no Google Brasil + checar se site aparece em painel AI Overviews / AI Mode. Print quando aparece.

- [ ] **Step 5: Consolidar em `audit-geo.md`**

```markdown
# Auditoria GEO / AI Readiness

## llms.txt + AI bots

| # | Site | llms.txt | llms-full.txt | GPTBot allow | ClaudeBot allow | PerplexityBot allow |
|---|---|---|---|---|---|---|
| 1 | ... | ✅ | ❌ | ✅ | ✅ | ✅ |
| ... |

## Brand mentions (5 queries × 15 sites = 75 spot checks)

| # | Site | Queries citado / 5 | Best snippet | Source |
|---|---|---|---|---|
| ... |

## Passage citability score (avg)

| # | Site | Score (1-5) |
|---|---|---|
| ... |

## AI Overviews coverage

| # | Site | Queries aparece / 3 | Print path |
|---|---|---|---|
| ... |

## Oportunidades pra GaspLab
1. **N% dos concorrentes BR sem llms.txt** — GaspLab tem; #G1 enriquece pra passage-citable.
2. ...
```

- [ ] **Step 6: Commit**

```bash
git add docs/research/audit-geo.md
git commit -m "research(competitor): auditoria GEO + AI readiness (#C4)"
```

---

## Task 5: Síntese + recomendações — #C5

**Files:**
- Modify: `docs/research/2026-05-competitor-audit.md` (adicionar §2-§8)

- [ ] **Step 1: Escrever §2 (lista + scores agregados)**

Cross-reference das 3 tabelas (visual/seo/geo); produzir score consolidado por site.

- [ ] **Step 2: Escrever §3 (top 25 patterns visuais)**

Pra cada um dos 25 patterns mais notáveis (do `audit-visual.md`), escrever:
- Nome
- Descrição estrutural (3-5 linhas)
- Print referência (link pra arquivo em `screenshots/`)
- Qual concorrente usa
- Aplicabilidade pra GaspLab (qual tema #02 absorve, ou qual rota #05 deveria adotar)

- [ ] **Step 3: Escrever §4 (top 10 microcopy patterns)**

Hero headlines, CTAs, trust strips — formato fixo + exemplo concreto.

- [ ] **Step 4: Escrever §5 (SEO/schema gaps que GaspLab pode explorar)**

Lista priorizada de "concorrentes não fazem X; se fizermos primeiro, ranqueamos acima":
- Vehicle schema (70% não têm) → reforça #S4
- Canonical absoluto (45% sem) → reforça #S6
- FAQPage schema (80% sem) → reforça #S5
- Internal linking de "related cars" (90% sem) → reforça #S8

- [ ] **Step 5: Escrever §6 (GEO opportunities)**

Concorrentes sem llms.txt, sem schema completo, com passage citability baixo — todos GAPs que viram vantagem da GaspLab quando #G1-#G4 entregarem.

- [ ] **Step 6: Escrever §7 (recomendações por frente)**

```markdown
## §7. Recomendações por frente

### Pra Frente 02 Variations
- **Tema cinematic-dark** absorve patterns 1, 3, 7, 12 (asimétrico, monogram, gradient mask, dark base premium).
- **Tema editorial-light** absorve patterns 2, 8, 15 (full-bleed lifestyle, magazine grid, serif display).
- **Tema showroom-minimal** absorve patterns 4, 11, 19 (axial centrado, product photography, much whitespace).
- Heurística de auto-pick refinada com base nos personas dos sites top-scored.

### Pra Frente 04 GEO
- Padronizar microcopy começando com `<business_name>` (pattern 23 — adotado pelos top 3 GEO-scored).
- Adicionar `<address>` semântico no header (pattern 25 — só 3/15 fazem).
- llms.txt enriquecido nos moldes do template adotado por Carvana.

### Pra Frente 05 Premium Pass
- Home above-the-fold: adotar pattern 1 (asimétrico) pro tema cinematic e pattern 2 (editorial) pro editorial.
- Estoque listagem: filtros persistentes em URL (todos os marketplaces fazem; 0/8 BR dealers).
- CarDetail: pattern 17 (sticky installment bar mobile) confirmado por 4/4 marketplaces.
```

- [ ] **Step 7: Escrever §8 (anti-patterns)**

Lista de coisas que vimos repetidas e devemos NÃO fazer:
- Popups agressivos com newsletter no load (`window.popups`)
- Sliders gigantes carousel de 8 slides
- Scroll-jacking via `wheel` event override
- Pre-loaders de marca > 3s
- "5 pessoas vendo este carro agora" (fake urgency)
- Chatbot intrusivo full-screen no load

- [ ] **Step 8: Apresentação síncrona ao Vinícius**

Agendar reunião / call de walkthrough. Compartilhar tela do relatório, navegar pelas 8 seções, anotar feedback in-place.

- [ ] **Step 9: Commit final**

```bash
git add docs/research/2026-05-competitor-audit.md
git commit -m "research(competitor): síntese + recomendações finais (#C5)"
```

- [ ] **Step 10: Abrir PR de docs research**

```bash
gh pr create --title "research(competitor): auditoria de 15 sites + heurísticas (#C1-#C5)" \
  --body "Fecha discovery da Frente 01. Output alimenta decisões de Frentes 02, 04, 05.

## Closes
Closes #C1, #C2, #C3, #C4, #C5

## Entregas
- Relatório \`docs/research/2026-05-competitor-audit.md\` (8 seções)
- Tabelas \`audit-visual.md\`, \`audit-seo.md\`, \`audit-geo.md\`
- 75 screenshots em \`screenshots/\`

## Próximos passos
- Atualizar specs Frente 02, 04, 05 com heurísticas extraídas (§7 do relatório)
- Apresentação síncrona ao Vinícius agendada

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ #C1 lista de 15 sites → Task 1
- ✅ #C2 auditoria visual → Task 2
- ✅ #C3 auditoria SEO/perf → Task 3
- ✅ #C4 auditoria GEO → Task 4
- ✅ #C5 síntese → Task 5

**Placeholder scan:** Sem TBD. Templates de tabela são exemplos concretos pra preencher.

**Notes for executor:**
- Frente puramente research; sem TDD aplicável.
- Skills MCP fazem o trabalho pesado; engenheiro consolida + julga critério.
- Reservar tempo de Vinícius (~2h) pra approval da lista (Task 1) e walkthrough final (Task 5).
- Outputs alimentam direto issues Frente 02 (#V2 escolha de palette/typography), Frente 04 (#G6 microcopy patterns), Frente 05 (todas as #P).
