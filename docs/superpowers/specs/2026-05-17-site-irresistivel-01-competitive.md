# Frente 01 — Competitive Analysis (Discovery)

> Sub-spec de [`site-irresistivel-northstar.md`](./2026-05-17-site-irresistivel-northstar.md). Frente **discovery** que alimenta decisões das frentes 02, 04 e 05.

| Campo | Valor |
|---|---|
| Status | Draft |
| Tipo | Research / Discovery (sem produção de código de produto) |
| Duração estimada | 3-5 dias úteis |
| Bloqueia | Decisões finais de #02 Variations e #05 Premium Pass |
| Pode rodar em paralelo com | #03 SEO Infra |

---

## 1. Problema

Hoje as decisões de design dos sites gerados estão baseadas em intuição + screenshots avulsos. Não temos benchmark sistemático contra:

- Concessionárias premium reais que **convertem** (o que o cliente final de luxo espera ver).
- Marketplaces brasileiros (Kavak, Webmotors, InstaCarro, MeuCarroNovo) que definem o "default mental" do comprador.
- Concessionárias OEM oficiais (BMW/Toyota/Volvo Brasil) com budget de design alto.

Sem isso, o premium-pass (#05) e o sistema de variations (#02) viram opinião sem dado.

---

## 2. Objetivo

Produzir **um relatório de auditoria** com:

1. **8-12 concessionárias premium BR** cobrindo: luxo (BMW/Audi/Porsche dealers), seminovos premium (independentes), elétricos (Tesla-like), familiar premium (Volvo/Honda).
2. **4 marketplaces de referência**: Kavak, Webmotors, InstaCarro, MeuCarroNovo.
3. **3 concessionárias dos EUA** como teto de qualidade visual: Carvana, Vroom, plus 1 dealer Lexus boutique (ex: Lexus of Beverly Hills).
4. **Scores em 6 eixos** (1-5): visual quality, conversion clarity, SEO/schema, performance, GEO/AI readiness, trust signals.
5. **Heurísticas extraídas** (15-25 patterns concretos) que viram input pras frentes 02, 04, 05.

---

## 3. Issues propostas

### #C1 — Definir lista final de 15 sites a auditar

**AC:**
- [ ] Lista de 15 URLs publicada em `docs/research/2026-05-competitor-audit.md` §1.
- [ ] Cada URL com 1-linha justificando inclusão (persona, posicionamento).
- [ ] Critérios de exclusão documentados (ex: "ignoramos dealers com site WordPress padrão sem customização").
- [ ] PO aprova lista antes de auditoria começar.

**Skills:** `seo-dataforseo` (busca SERP "concessionária premium <cidade>" pra identificar candidatos), `WebFetch` (verificação rápida que o site está no ar).

**Sem UI.** Pula `frontend-design`.

---

### #C2 — Auditoria visual + conversion (15 sites)

**AC:**
- [ ] Para cada URL: 5 screenshots (hero desktop, hero mobile, listagem estoque, detalhe carro, contato) em `docs/research/screenshots/<slug>/`.
- [ ] Score 1-5 em: visual quality, conversion clarity, microcopy quality, motion/animation, mobile parity, trust signals.
- [ ] Tabela consolidada em `audit-visual.md`.
- [ ] Top-3 patterns visuais notáveis por site (extração de devices: hero pattern, CTA pattern, gallery pattern).

**Skills:** `seo-visual` (Playwright screenshots), `WebFetch` (markdown extraction de microcopy), revisão manual.

---

### #C3 — Auditoria SEO + Schema + Performance (15 sites)

**AC:**
- [ ] Para cada URL: Lighthouse mobile (perf + SEO + a11y + BP) + DataForSEO on-page audit.
- [ ] Schema detection (LocalBusiness/AutoDealer/Vehicle/FAQPage) — quem tem, quem não tem.
- [ ] CrUX field data quando disponível.
- [ ] Internal linking depth + URL structure analysis.
- [ ] Tabela consolidada em `audit-seo.md`.

**Skills:** `seo-technical`, `seo-schema`, `seo-google` (PageSpeed Insights API + CrUX), `seo-page`, `seo-dataforseo`.

---

### #C4 — Auditoria GEO / AI Readiness (15 sites)

**AC:**
- [ ] Para cada URL: presença de `llms.txt`, `robots.txt` AI bot allowlist, brand mention em queries amostrais (ChatGPT, Perplexity).
- [ ] Passage citability score (heurística manual em 5 trechos por site).
- [ ] AI Overviews coverage: ranquear "concessionária <bairro>" e capturar se site aparece em AI panel.
- [ ] Tabela consolidada em `audit-geo.md`.

**Skills:** `seo-geo`, `seo-dataforseo` (AI visibility ChatGPT scraper).

---

### #C5 — Síntese: heurísticas + recomendações pra GaspLab

**AC:**
- [ ] `docs/research/2026-05-competitor-audit.md` finalizado com 8 seções:
  1. Resumo executivo (1 página)
  2. Lista de 15 sites + scores
  3. Top 25 patterns visuais identificados (com print + descrição estrutural + qual concorrente usa)
  4. Top 10 microcopy patterns (hero headlines, CTAs, trust strips)
  5. SEO/Schema gaps que GaspLab pode explorar pra ranquear acima
  6. GEO opportunities (concorrentes sem llms.txt, sem schema completo)
  7. Recomendações por frente: o que #02 deve absorver, o que #04 deve absorver, o que #05 deve absorver
  8. Lista de "anti-patterns" — coisas que vimos repetidas e devemos evitar (popups agressivos, sliders gigantes, scroll-jacking)
- [ ] Apresentação síncrona pro Vinícius (slides ou doc + walkthrough).

**Skills:** revisão manual + `superpowers:writing-clearly-and-concisely` (se disponível).

---

## 4. Estrutura de output

```
docs/research/
├── 2026-05-competitor-audit.md           # Relatório principal (consolidado)
├── audit-visual.md                        # Tabela visual scores + patterns
├── audit-seo.md                           # Tabela SEO/perf
├── audit-geo.md                           # Tabela GEO
└── screenshots/
    ├── kavak/
    │   ├── hero-desktop.png
    │   ├── hero-mobile.png
    │   └── ...
    ├── webmotors/
    │   └── ...
    └── ...
```

---

## 5. Critérios de saída (Definition of Done da frente)

- [ ] 5 issues fechadas (#C1-#C5).
- [ ] Relatório `2026-05-competitor-audit.md` aprovado pelo Vinícius.
- [ ] Heurísticas extraídas referenciadas em commits/PRs das frentes 02, 04, 05.
- [ ] Screenshots commitados (ou linkados via S3/Drive se >100MB).

---

## 6. Dependências, riscos, fora-de-escopo

**Dependências externas:**
- DataForSEO MCP server (já configurado per CLAUDE.md global).
- PageSpeed Insights API key (já configurado per #233).
- Acesso ChatGPT/Perplexity pra spot-check de citations (manual).

**Riscos:**
- Concessionárias premium BR podem ter sites genéricos demais → fallback: incluir mais sites US/EU como teto.
- Screenshots de 15 sites × 5 cada = 75 imagens; vigiar tamanho do repo. Mitigação: WebP + ≤500KB cada, ou hospedar em S3 + linkar.
- Análise GEO é parcialmente manual; reservar tempo de Vinícius pra spot-checks (~2h).

**Fora de escopo:**
- Análise de tráfego de concorrentes via SimilarWeb/SEMrush (precisaria de licença paga; não compensa pra discovery).
- Auditoria de UX além do site (apps mobile, integração WhatsApp).
- Reviews de Google Maps (cobertura em #03 SEO Infra via seo-maps).
