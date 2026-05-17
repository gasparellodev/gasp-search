# Frente 02 — Layout Variations (3 temas)

> Sub-spec de [`site-irresistivel-northstar.md`](./2026-05-17-site-irresistivel-northstar.md). Implementa 3 temas isolados pra que dois leads jamais pareçam "irmãos óbvios".

> **🚫 FRENTE CANCELADA — 2026-05-17 (post-discovery).** Conflito arquitetural irreconciliável com decisão de PR #317 (Wave C) + `components/sites/CLAUDE.md:62`: *"Site público é uniformemente branco/preto/vermelho"*. Dark mode foi removido completamente; `data-theme="auto-showroom"` é hardcoded em `app/sites/[slug]/layout.tsx:85`. **Issues #349-#360 fechadas como `not planned`; milestone #10 fechada.** Variação visual entre sites continua via: (a) cor primária do lead (`--site-primary` CSS var), (b) manifest IA de fotos (#217), (c) tipografia/copy contextual. Spec preservada como registro histórico do plano original.

| Campo | Valor |
|---|---|
| Status | Draft |
| Tipo | Feature multi-issue (refactor + novas features) |
| Duração estimada | 8-12 dias úteis |
| Depende de | #01 Competitive (heurísticas) — pode começar specs em paralelo, dev espera resultado |
| Bloqueia | Rollout completo de #05 Premium Pass |

---

## 1. Problema

Hoje, todo lead renderiza o mesmo template (`<SitePage>` → `<HomeHero>` etc.) variando apenas:

- Cor primária (CSS var `--site-primary`).
- Imagens (manifest IA).
- Textos (`SiteVariables`).
- Logo.

Resultado: dois sites do gasp-search lado-a-lado parecem **claramente do mesmo molde**. Cliente premium percebe isso na primeira visita. Concorrente com 3 dealers no mesmo bairro vê e bloqueia a venda.

---

## 2. Objetivo

Sistema de **3 temas** (`cinematic-dark` / `editorial-light` / `showroom-minimal`) onde:

1. Cada tema produz visualmente um site claramente diferente — não só "claro vs escuro".
2. Componentes são **theme-aware** via tokens (CSS vars + mapeamento JSON), **sem duplicar árvores de componentes**.
3. Lead pode escolher tema no admin GaspLab; fallback é heurística baseada em `brand_personality` + categorias de carro.
4. Manifest IA gera prompts adequados ao tema (ex: `cinematic-dark` pede hero noturno; `showroom-minimal` pede fundo branco).
5. Troca de tema em produção invalida cache (`updateTag('site:<slug>')`) e regenera screenshots/OG.

---

## 3. Decisões de design

### 3.1 Os 3 temas

| Theme ID | Vibe | Persona | Hero | Tipografia | Cor primária default | Layout |
|---|---|---|---|---|---|---|
| `cinematic-dark` | "Showroom à meia-noite" — luxo, drama, mistério | Esportivos, premium luxo (BMW M, Audi RS, Porsche) | Foto noturna asimétrica, monogram bottom-right, gradient mask | Display serif moderno (Playfair?) + sans-serif tight (Inter) | `#9F1239` (rose-800) default | Asimétrico, generoso, dark base (`#0C0C0C`) |
| `editorial-light` | "Magazine premium" — clean, espaçoso, fotográfico | Premium acessível, família-premium (Volvo, Honda, Toyota linha alta) | Foto diurna lifestyle + headline editorial, full-bleed | Display serif clássico (Cormorant?) + sans (Inter) | `#1E3A8A` (blue-900) default | Centrado-editorial, light base (`#FCFCFC`) |
| `showroom-minimal` | "Tesla-style" — minimalismo, tech, foco no carro | Elétricos, tech, minimalistas (Tesla, Polestar, iCarros tech) | Foto product em fundo neutro (cinza claro), texto minimo | Sans-serif clean (Inter) only, sem serif | `#0F172A` (slate-900) default | Centrado axial, much white space, base `#FAFAFA` |

A cor primária do lead **sobrescreve** o default; o tema só define o restante (tokens secundários, escala de cinzas, motion timing).

### 3.2 Modelo de dados

**Migração SQL:**

```sql
ALTER TABLE lead_sites
  ADD COLUMN theme_id TEXT NOT NULL DEFAULT 'cinematic-dark'
    CHECK (theme_id IN ('cinematic-dark', 'editorial-light', 'showroom-minimal'));

CREATE INDEX lead_sites_theme_id_idx ON lead_sites(theme_id);

COMMENT ON COLUMN lead_sites.theme_id IS
  'Phase 7 Wave Irresistível #02. Tema visual aplicado ao site público. '
  'Resolução: override manual (admin GaspLab) > heurística (brand_personality + car categories) > default cinematic-dark. '
  'Troca invalida cache via updateTag(site:<slug>) e regenera OG/screenshots.';
```

### 3.3 Arquitetura de tokens

```ts
// lib/sites/themes/types.ts
export type ThemeId = 'cinematic-dark' | 'editorial-light' | 'showroom-minimal';

export interface ThemeTokens {
  id: ThemeId;
  mode: 'dark' | 'light';
  surface: { base: string; raised: string; sunken: string; overlay: string };
  text:    { primary: string; secondary: string; muted: string; inverse: string };
  border:  { subtle: string; default: string; strong: string };
  motion:  { duration: { fast: string; base: string; slow: string }; easing: string };
  radius:  { sm: string; md: string; lg: string; full: string };
  typography: {
    display: { family: string; weight: number; tracking: string };
    body:    { family: string; weight: number; tracking: string };
  };
  layout: { heroVariant: 'asymmetric' | 'editorial' | 'axial'; gridGap: string };
  imagePrompts: { hero: string; about: string; contact: string; categories: string };
}
```

CSS vars são injetadas pelo `<SitePage>` com prefixo `--site-`:

```css
--site-surface-base / --site-surface-raised / --site-surface-sunken
--site-text-primary / --site-text-secondary / --site-text-muted
--site-border-subtle / --site-border-default
--site-motion-fast / --site-motion-base / --site-motion-slow / --site-easing
--site-radius-sm / --site-radius-md / --site-radius-lg
--site-display-family / --site-body-family
```

Componentes consomem via `style={{ background: 'var(--site-surface-base)' }}` ou utility Tailwind quando estável.

### 3.4 Heurística de auto-seleção

Função `pickDefaultTheme(brand_personality, categories): ThemeId`:

```
elétrico OR tech_first → showroom-minimal
luxo OR esportivo OR premium → cinematic-dark
familiar OR acessível OR seminovo → editorial-light
fallback → cinematic-dark
```

Heurística refinada após output de #01 Competitive.

---

## 4. Issues propostas

### #V1 — Migração `lead_sites.theme_id` + tipos + heurística

**AC:**
- [ ] Migration SQL aplicada (versão Supabase + idempotente).
- [ ] `types/database.ts` regenerado.
- [ ] `lib/sites/themes/types.ts` com `ThemeId`, `ThemeTokens`.
- [ ] `lib/sites/themes/pick-default.ts` com `pickDefaultTheme()` + 100% coverage.
- [ ] Backfill: leads existentes ficam com `cinematic-dark` (default da column).
- [ ] PO valida que default não muda visual de sites já publicados.

**Skills:** TDD obrigatório. Sem UI.

---

### #V2 — Token registry: `editorial-light`

**AC:**
- [ ] `lib/sites/themes/editorial-light.ts` exporta `ThemeTokens` completo.
- [ ] Tokens revisados por `frontend-design:frontend-design` (intent visual).
- [ ] `lib/sites/themes/index.ts` registra theme com `getThemeTokens(id)`.
- [ ] Test snapshot dos tokens (`tests/unit/lib/sites/themes/`).

---

### #V3 — Token registry: `showroom-minimal`

**AC idem #V2** (refatorando).

---

### #V4 — Refator `<SitePage>` pra injetar tokens do tema ativo

**AC:**
- [ ] `<SitePage>` recebe `theme_id` (default do site) e injeta CSS vars via `<style>` inline.
- [ ] Backward compat: se `theme_id` ausente, usa `cinematic-dark`.
- [ ] `wcagContrast()` re-calculado por tema (cada tema tem `text_on_primary` calculado vs sua surface).
- [ ] Testes regressivos: rota `/sites/<slug>` com 3 temas distintos renderiza CSS vars corretas.

**Skills:** `vercel:react-best-practices` audit.

---

### #V5 — `<HomeHero>` theme-aware

**AC:**
- [ ] Hero detecta `theme_id` via prop + escolhe sub-componente layout:
  - `cinematic-dark` → atual `HomeHeroBackground` asimétrico (já implementado).
  - `editorial-light` → novo `HomeHeroEditorial` full-bleed centrado, display serif grande.
  - `showroom-minimal` → novo `HomeHeroMinimal` axial, foto product centrada, headline pequeno.
- [ ] `frontend-design:frontend-design` produz mockup pra cada um antes do dev codar.
- [ ] Cada layout tem `prefers-reduced-motion` honrado.
- [ ] Testes RTL: render dos 3 temas, asserts em estrutura distinta.
- [ ] Lighthouse mobile ≥ 90 pros 3.

---

### #V6 — `<HomeQuickSearchBar>` + `<HomeTrustStrip>` theme-aware

**AC:**
- [ ] QuickSearchBar adapta estética (glass dark pra cinematic, white card pra editorial, inline minimal pra showroom).
- [ ] TrustStrip adapta ícones + spacing (badge style pra editorial, banner pra cinematic, minimal text-only pra showroom).
- [ ] Testes asseguram contraste WCAG AA nos 3 temas.

---

### #V7 — `<HomeRecentArrivals>` + `<HomeCategoriesCars>` theme-aware

**AC:**
- [ ] Cards de carro variam aspect ratio + treatment de imagem por tema (overlay gradient pra cinematic; clean white card pra editorial; full-bleed pra minimal).
- [ ] Categorias adaptam grid (3-col asimétrico cinematic, 4-col uniforme editorial, 6-col enxuto minimal).

---

### #V8 — Footer + Header theme-aware

**AC:**
- [ ] `<SiteHeader>` adapta densidade + treatment (transparente over hero pra cinematic, solid + border pra editorial, sticky minimal pra showroom).
- [ ] `<SiteFooter>` adapta cor base + layout (dark cinematic, light editorial cards, ultra-minimal showroom).

---

### #V9 — Manifest IA prompts por tema

**AC:**
- [ ] `lib/sites/visual-identity/prompts.ts` aceita `theme_id` e produz prompts adequados:
  - `cinematic-dark`: "noturno, low-key lighting, asimétrico, drama".
  - `editorial-light`: "diurno, lifestyle, sky, ampla, magazine-quality".
  - `showroom-minimal`: "product photography, fundo neutro cinza claro, foco no veículo, sem distração".
- [ ] Server Action `regenerateVisualIdentity` aceita `theme_id` opcional (default = `theme_id` do site).
- [ ] Cache: trocar tema invalida manifest e dispara regeneração com novos prompts.

**Skills:** `claude-api` (revisão dos prompts Anthropic).

---

### #V10 — Admin UI: seletor de tema no editor de site

**AC:**
- [ ] Rota `(app)/sites/edit/[id]` ganha select de 3 temas (radio cards com preview thumbnail).
- [ ] Mudança dispara `updateLeadSite({ theme_id })` + toast de confirmação.
- [ ] Aviso UX: "trocar tema regenera imagens — aprox. 2min".
- [ ] Validação: não permite trocar pra tema inválido.
- [ ] `vercel:shadcn` consulta pra radio cards.

---

### #V11 — Visual regression: snapshots por tema

**AC:**
- [ ] Playwright captura screenshots do site público em 6 viewports (mobile/tablet/desktop × dark/light? não, por tema, 3 temas × 2 viewports = 6).
- [ ] Snapshots commitados em `tests/visual/themes/`.
- [ ] CI roda diff visual; threshold 0.1% pixel diff.

---

### #V12 — Documentação + retropr nos componentes legados

**AC:**
- [ ] `components/sites/CLAUDE.md` atualizado com seção "Theming".
- [ ] `components/sites/home/CLAUDE.md` atualizado.
- [ ] `docs/superpowers/specs/2026-05-17-site-irresistivel-02-variations.md` recebe nota "shipped" no final.
- [ ] Lista de componentes que ainda NÃO são theme-aware (carry-over pra futuras issues).

---

## 5. Estratégia de rollout

1. Issues #V1-#V4 mergem juntas (foundation; nenhum impacto visual ainda).
2. #V5-#V8 mergem por tema completo (ex: editorial-light primeiro, validar com 1 lead piloto, depois showroom-minimal).
3. #V9 entra junto com primeiro tema novo, pra que regeneração de manifest aconteça.
4. #V10 vai pro fim — UI admin só faz sentido com pelo menos 2 temas finalizados.
5. #V11 + #V12 fecham a frente.

**Flag de rollout:** `theme_id` default fica `cinematic-dark`. Leads existentes não veem mudança até troca manual. Permite rollback parcial.

---

## 6. Critérios de saída

- [ ] 12 issues fechadas.
- [ ] 3 sites de exemplo publicados (1 por tema) — links no PR de fechamento.
- [ ] Blind test "estes 2 sites são do mesmo provedor?" passa: ≤ 40% de "sim".
- [ ] Documentação `components/sites/CLAUDE.md` reflete arquitetura final.
- [ ] Zero regressão visual em sites com `theme_id = cinematic-dark` (snapshot diff = 0%).

---

## 7. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Componentes viram switch gigante `theme === 'X' ? ... : ...` | Usar **tokens** + sub-componentes nomeados por tema (`HomeHero<ThemeName>`) só onde estrutura difere |
| Cache invalidation por troca de tema falha | Teste E2E que troca tema e valida hash do HTML mudou |
| Manifest IA antigo (gerado pré-tema) fica inconsistente quando lead troca | Server Action força regen; usuário aceita 2min de espera (UX aviso) |
| 3 temas explodem coverage de testes | Snapshot test cobre re-render; lógica core é testada 1× independente do tema |
| Tipografia custom (Cormorant, Playfair) impacta LCP | `next/font` com `display: swap` + subset; pre-load só do display family ativo |

---

## 8. Fora de escopo (V2+)

- Customização per-componente (lead escolhe hero do tema A mas categories do tema B). V1 = tema é all-or-nothing.
- Builder de tema (lead cria seu próprio). V1 = só os 3 oficiais.
- Modo dark/light dentro de cada tema (cada tema tem 1 modo fixo). Pode ser revisitado se #05 Premium Pass identificar demanda.
