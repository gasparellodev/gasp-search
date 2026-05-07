# `.github/` — Spec Técnica

## Propósito

Configuração do GitHub para o repositório: workflows de CI, templates de PR e Issue, CODEOWNERS.

## Como adicionar

- **Workflows**: arquivos YAML em `workflows/`. Nome do job deve bater com o **status check** referenciado em branch protection (`lint`, `typecheck`, `unit`, `e2e`, `build`). Ao adicionar um novo job que precisa ser gate de merge, atualizar branch protection via `gh api`.
- **Templates**:
  - `PULL_REQUEST_TEMPLATE.md`: usado automaticamente quando um PR é aberto.
  - `ISSUE_TEMPLATE/`: templates por tipo (feature, bug). Cada template é um YAML form.
- **CODEOWNERS**: padrão `path @owner`. Auto-assigna review.

## Regras de negócio

1. **CI gates não-negociáveis.** Os 5 jobs (`lint`, `typecheck`, `unit`, `e2e`, `build`) precisam estar verdes para merge em `main`.
2. **Idempotência.** Workflows devem ser tolerantes a estado intermediário do projeto: jobs detectam ausência de `package.json` (early-return graceful) para que os primeiros PRs (sem código Next.js ainda) passem.
3. **Concurrency.** Cancelar runs anteriores no mesmo branch via `concurrency.group`.
4. **Secrets.** Workflows referenciam `${{ secrets.* }}` com fallback para placeholder em testes locais. Secrets reais setados via `gh secret set`.
5. **Cache npm** habilitado (`actions/setup-node` com `cache: npm`) para acelerar.
6. **Actions pinadas por SHA.** Manter comentário com a versão humana acima de
   cada `uses:` pinado e deixar Dependabot cuidar dos bumps.

## Arquivos

| Path | Propósito |
|---|---|
| `workflows/ci.yml` | Lint + typecheck + unit + e2e + build em todo PR e push de `main` |
| `dependabot.yml` | Atualizações semanais de GitHub Actions pinadas por SHA |
| `PULL_REQUEST_TEMPLATE.md` | Checklist obrigatório de PR (Summary, Test plan, Quality gates) |
| `ISSUE_TEMPLATE/feature.yml` | Form de feature request (resumo, critérios, testes, fase) |
| `ISSUE_TEMPLATE/bug.yml` | Form de bug report (repro, expected, actual, env) |
| `ISSUE_TEMPLATE/config.yml` | Desabilita blank issues; aponta Discussions |
| `CODEOWNERS` | Auto-assign de reviews por área crítica |

## Dependências

- `gh` CLI (local) para configurar secrets e branch protection.
- GitHub Actions runners (`ubuntu-latest`).
- Node 24 LTS (alinhado ao runtime Vercel).

## Quando atualizar este `CLAUDE.md`

- Novo job no CI.
- Nova convenção de PR/Issue.
- Mudança em status checks exigidos.
