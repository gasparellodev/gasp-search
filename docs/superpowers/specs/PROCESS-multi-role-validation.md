# Workflow multi-papel — gasp-search

Define os **4 papéis** que toda issue desta spec atravessa antes do merge na `main`. Aplica-se especialmente ao [Gerador de Sites](./2026-05-08-gerador-sites-concessionarias-design.md), mas serve como template pra qualquer feature complexa do gasp-search.

| Status | Valor |
|---|---|
| Versão | 1.0 |
| Adotado | 2026-05-08 |
| Owner | Vinícius (GaspLab) |

---

## 1. Filosofia

- **Nada vai pra `main` sem passar pelos 4 papéis.** Isso vale tanto pra você (Vinícius) executando os papéis sequencialmente quanto pra delegação a subagents/skills do Claude Code.
- **Cada papel produz artefato verificável** (checklist marcada, report em arquivo, comentário no PR). Não confiar em "passou na minha cabeça".
- **Bloqueios são por design.** Se QA reprovou, dev volta. Se PO disse que AC mudou, dev re-implementa.

---

## 2. Os 4 papéis

### 2.1 Product Owner (PO)

**Antes do dev começar:**
- Reler a issue e o spec mestre. Confirmar que os Acceptance Criteria (AC) estão completos e testáveis.
- Se ambíguo, refinar AC antes de o dev abrir branch.
- Adicionar ao corpo da issue: link pro frame Figma específico (quando UI), link pro CLAUDE.md afetado, dependências em outras issues.

**Após PR aberto pelo dev:**
- Validar que o PR cumpre **cada bullet de AC**. Marcar checkbox correspondente.
- Se AC não foi cumprido, comentar `❌ AC #N não atendido: <motivo>` e bloquear merge até dev corrigir.
- Confirmar UX: se UI, navegar a feature ponta-a-ponta no preview e descrever o fluxo no comentário.

**Skills/agents úteis:**
- `superpowers:requesting-code-review` (acceptance check estruturado)

### 2.2 Developer (Dev)

**Antes de codar:**
- Reler issue + spec + CLAUDE.md das pastas afetadas.
- Confirmar AC com PO se algo estiver vago.
- Criar branch `feat/<issue#>-<slug>`.
- Em features de UI, **abrir o Figma do frame relevante** lado-a-lado com o editor.

**Durante a implementação:**
- TDD em lógica de `lib/` e `app/api/`. UI fica fora do TDD estrito mas tem testes funcionais.
- Atualizar `CLAUDE.md` da pasta tocada na mesma PR.
- Confirmar lint zero, typecheck zero, coverage targets do CLAUDE.md raiz.

**Após implementação:**
- Rodar localmente:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test` (com coverage)
  - `npm run test:e2e` (se houver E2E afetado)
  - `npm run build` (sanity check de produção)
- Self-review do diff antes de pedir review humana/QA.
- Abrir PR com formato Sentry (`sentry-skills:pr-writer`).

**Skills/agents úteis:**
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`
- `vercel:react-best-practices` (se TSX)
- `frontend-design:frontend-design` (se UI complexa)

### 2.3 QA Tester (QA)

**Funcional:**
- Rodar a feature seguindo cada AC. Marcar pass/fail.
- Testar edge cases: input vazio, valor extremo, network failure, RLS violation, dado faltando do lead.
- Se backend, validar resposta de erro (status code, mensagem, log).

**Visual (issues com label `type:ui`):**
- Exportar PNG do Figma via `mcp__figma__download_figma_images`. Salvar em `tests/visual/figma-baseline/<issue#>-<frame>.png`.
- Capturar screenshot da implementação em 2 viewports (desktop 1906×, mobile 375×) via Playwright.
- Diff lado-a-lado. Tolerância: ≤ 5% pixel-diff OU justificativa textual ("logo é parametrizável: ground truth varia").
- Anexar imagens + diff ao comentário do PR.

**Output:**
- Comentário estruturado no PR:
  ```
  ## QA Report — issue #NN
  - [x] AC 1: pass
  - [x] AC 2: pass
  - [ ] AC 3: fail — <descrição>
  - Visual diff: <link ou anexo>
  - Edge cases testados: <lista>
  - Verdict: APPROVE / REQUEST CHANGES
  ```

**Skills/agents úteis:**
- `seo-visual` (screenshots Playwright)
- `mcp__figma__download_figma_images` (export Figma)
- `sentry-skills:find-bugs` (review de comportamento)

### 2.4 Code Reviewer (Reviewer)

- Rodar `sentry-skills:code-review` no PR.
- Rodar `sentry-skills:security-review` no PR.
- **Atenção especial pra esta spec:**
  - `service_role` confinado a `lib/supabase/service.ts` server-only?
  - RLS bypass tem teste integrado?
  - XSS sanitization confirmada nas variáveis vindas da IA?
  - Rate limit no Server Action de geração?
  - Logs sem PII (whatsapp/email/address)?
- Adicionar como reviewer no PR. Aprovar só após `code-review` e `security-review` rodados e achados endereçados.

**Skills/agents úteis:**
- `sentry-skills:code-review`
- `sentry-skills:security-review`
- `sentry-skills:gha-security-review` (se PR mexe em workflows)

---

## 3. Como executar os 4 papéis — slash commands operacionais

**Os 4 papéis são EXECUTADOS por subagents reais, não simulados mentalmente.** A infra está em `.claude/agents/` e `.claude/commands/` (commitada no repo).

### Subagents disponíveis

| Subagent | Arquivo | Papel |
|---|---|---|
| `site-po` | `.claude/agents/site-po.md` | Product Owner |
| `site-dev` | `.claude/agents/site-dev.md` | Developer |
| `site-qa` | `.claude/agents/site-qa.md` | QA Tester |
| `site-reviewer` | `.claude/agents/site-reviewer.md` | Code Reviewer |

### Slash commands (em `.claude/commands/`)

| Comando | O que faz |
|---|---|
| `/site-po <issue#>` | Invoca site-po: refina AC pré-dev OU valida AC pós-PR |
| `/site-dev <issue#>` | Invoca site-dev: cria branch, TDD, abre PR (gate: PO validou) |
| `/site-qa <issue#>` | Invoca site-qa: testes funcionais + visual diff vs Figma |
| `/site-reviewer <issue#>` | Invoca site-reviewer: code-review + security-review + decisão (gate: QA APPROVE) |
| `/site-workflow <issue#>` | Orquestra todos os 4 em sequência, com pausas em falhas |

### Fluxo padrão por issue

```
/site-po 153          # Phase 1: PO refina AC → comenta "✅ AC validated"
↓
/site-dev 153         # Phase 2: Dev implementa → abre PR → comenta "🚧 Dev implemented in PR #N"
↓
/site-po 153          # PO valida pós-PR → review com Verdict: PASS
↓
/site-qa 153          # Phase 3: QA testa funcional + visual → comenta "🧪 QA APPROVE"
↓
/site-reviewer 153    # Phase 4: Reviewer aprova ou bloqueia o PR
↓
(humano clica squash merge manualmente)
```

### Atalho com workflow completo

```
/site-workflow 153
```

Roda Phase 1 → 2 → 3 → 4 sequencialmente. Para automaticamente em qualquer falha (PO needs refinement / Dev quality gate fail / QA request changes / Reviewer block).

**Não mergeia automaticamente** — o squash merge final é humano.

### Gates de execução (rigorosos)

Cada agent verifica pré-condições antes de agir:

| Agent | Gate de entrada | Falha se... |
|---|---|---|
| `site-po` (modo A) | nenhum | — |
| `site-po` (modo B) | PR existe | sem PR linkado |
| `site-dev` | comment `✅ AC validated by PO` na issue | PO não validou |
| `site-qa` | comment `🚧 Dev implemented in PR #N` na issue | dev não finalizou |
| `site-reviewer` | review do PO `Verdict: PASS` + comment `🧪 QA APPROVE em PR #N` | PO ou QA não aprovaram |

**Os gates não são burocracia — são contratos.** Pular gate = invalidar o workflow inteiro pra aquela issue.

---

## 4. Definição de pronto (DoD)

Issue só pode ser fechada quando:

- [ ] AC do PO 100% checked.
- [ ] CI verde (lint + typecheck + unit + e2e + build).
- [ ] Coverage targets atingidos (CLAUDE.md raiz: ≥ 80% lines/functions, ≥ 75% branches).
- [ ] QA report com APPROVE.
- [ ] Visual diff anexado (se `type:ui`).
- [ ] `sentry-skills:code-review` rodado e endereçado.
- [ ] `sentry-skills:security-review` rodado e endereçado.
- [ ] CLAUDE.md das pastas tocadas atualizado.
- [ ] PR squash-mergeado (auto-close via `Closes #N`).

---

## 5. Visual validation: ferramental técnico

### Setup mínimo

```bash
# tests/visual/setup.sh
mkdir -p tests/visual/figma-baseline tests/visual/screenshots tests/visual/diff
```

### Workflow QA

```bash
# 1. Export do Figma (substituir node ID por frame da issue)
# QA pede pro Claude rodar:
#   mcp__figma__download_figma_images com nodeId="5:3" → tests/visual/figma-baseline/

# 2. Capturar screenshot da implementação
npx playwright test --project=visual-desktop --update-snapshots
npx playwright test --project=visual-mobile --update-snapshots

# 3. Diff
npx playwright show-report
```

### Tolerância e exceções

| Cenário | Tolerância pixel-diff |
|---|---|
| Frame fixo (Footer, Form labels) | ≤ 1% |
| Frame com texto IA (Hero, About) | Skip pixel-diff; checar layout structure |
| Imagens parametrizadas (logo, hero photo) | Skip pixel-diff dos pixels da imagem; checar dimensão e posição |
| Cor primária parametrizada | Skip pixel-diff; checar que cor extraída tem WCAG ≥ AA |

QA documenta a tolerância usada no comentário do PR.

---

## 6. Quando este processo PODE ser pulado

Hot-fixes críticos (prod down, security incident, dado corrompido) podem fast-track:
- Dev → Reviewer (skipping PO + QA).
- Pós-merge: issue separada de "follow-up QA" pra cobrir o gap.

Nunca pular pra refactors, features ou melhorias de UX.
