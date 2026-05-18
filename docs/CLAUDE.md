# `docs/` — Spec Técnica

## Propósito

Documentação auxiliar versionada que complementa `README.md`, `HANDOFF.md` e
`CONTRIBUTING.md`.

## Regras

1. Screenshots usados no README ficam em `docs/screenshots/`.
2. Relatórios resumidos de auditoria ficam em `docs/audits/`.
3. Runbooks operacionais (procedimentos passo-a-passo pra operação ao
   vivo, recovery de incidentes, SLO de produto) ficam em
   `docs/runbooks/`. Atualizar quando código de domínio referenciado
   mudar (rate limits, error codes, telemetria).
3. Specs técnicas mestres (multi-fase, multi-role) ficam em
   `docs/superpowers/specs/` e **devem ser commitadas** — testes de snapshot
   e workflows de validação leem esses arquivos diretamente do repositório
   (CI roda `git checkout` limpo, sem dev-only artifacts).
4. Relatórios review-only (artefatos de auditoria multi-agent) ficam em
   `docs/superpowers/reports/`. Tratá-los caso a caso; em geral não
   precisam ser carregados por código de produção/teste.
5. Manter imagens e relatórios sem dados reais de clientes.
6. Atualizar o README quando um artefato desta pasta for criado para consumo
   direto por novos desenvolvedores.

## Arquivos

| Path | Propósito |
|---|---|
| `audits/2026-05-07-final-audit.md` | Resumo de coverage e Lighthouse da finalização do backlog |
| `runbooks/onsite-site-generation.md` | Procedimento operacional pra geração de site ao vivo na visita presencial (Sprint A+B+D do plano onsite). Inclui pré-visita, recovery por código de erro, e queries de Vercel logs sobre `generateLeadSite.outcome`. |
| `screenshots/app-overview.svg` | Visão estática das principais telas para onboarding do README |
| `superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md` | Spec mestre Phase 7 — Site Generator (Concessionárias). Contém SYSTEM_PROMPT canônico para `lib/sites/generate-copy.ts` (extraído via `readFileSync` em `tests/unit/lib/sites/generate-copy.test.ts` para snapshot byte-exact — AC6 da issue #158) |
| `superpowers/specs/PROCESS-multi-role-validation.md` | Workflow multi-role (PO → Dev → QA) referenciado nos bodies das issues do milestone Phase 7 |
| `SEO-PLAN.md` | Estratégia SEO de produto + arquitetura técnica completa (v1 Sprint 1 + v2 Frente 03 + GEO Frente 04). Decisões permanentes (FAQPage anti-pattern, Schema em noindex, llms.txt gate). Referência para novos devs antes de tocar `app/sites/**` ou `lib/sites/**`. |
