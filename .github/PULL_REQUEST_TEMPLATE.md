## Summary
<!-- 1-3 bullets do que mudou e por quê -->

-

## Issue relacionada
<!-- Use "Closes #N" para auto-fechar a issue quando o PR for mergeado -->

Closes #

## Test plan
<!-- Marque cada item conforme valida localmente -->

- [ ] `npm run lint` zero warnings
- [ ] `npx tsc --noEmit` zero erros
- [ ] `npm test` verde (coverage mantida ≥ 80% lines/functions, ≥ 75% branches em `lib/` e `app/api/`)
- [ ] `npm run test:e2e` verde quando aplicável
- [ ] Validei manualmente os fluxos afetados em `npm run dev`

## Quality gates

- [ ] **TDD**: testes falhando antes da implementação, depois passam
- [ ] **CLAUDE.md** atualizado em toda pasta com arquivos novos/modificados
- [ ] **`sentry-skills:code-review`** rodado, achados endereçados (comentar no PR)
- [ ] **`sentry-skills:security-review`** rodado, achados endereçados (comentar no PR)
- [ ] **CI verde** (`lint` + `typecheck` + `unit` + `e2e` + `build`)

## Notas de revisão
<!-- Pontos de atenção para o revisor: trade-offs, decisões não óbvias, follow-ups -->

-

## Screenshots
<!-- Para mudanças de UI, anexe antes/depois -->
