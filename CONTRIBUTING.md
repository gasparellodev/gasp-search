# Contribuindo com Gasp Search

Bem-vindo. Este documento descreve o fluxo de trabalho **obrigatório** para qualquer mudança no código.

> A spec técnica do projeto está em [`CLAUDE.md`](./CLAUDE.md). Cada subpasta com arquivos também tem seu próprio `CLAUDE.md`. Lê-los antes de tocar uma área é o caminho mais rápido.

---

## Setup local

```bash
git clone git@github.com:gasparellodev/gasp-search.git
cd gasp-search
npm install
cp .env.local.example .env.local
# Preencher chaves Supabase, Apify, Anthropic
npm run dev
```

Pré-requisitos:

- Node 24 LTS (alinhado ao CI)
- `gh` CLI logado
- Acesso ao projeto Supabase

---

## Branching

- Sempre branchar de `main` atualizada (`git pull --ff-only`).
- Nome: `<type>/<issue#>-<slug-curto>`. Ex.: `feat/14-google-maps-mapper`, `fix/22-tag-dedup`, `chore/2-ci-workflow`.
- Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- Uma issue por branch. Não acumule trabalho não relacionado.

---

## Commits

Convencionais, em PT-BR ou EN, mas consistentes dentro do PR:

```
<type>(<scope>): <descrição>

<corpo opcional explicando o porquê>

Closes #N

Co-Authored-By: ...
```

Exemplos:

- `feat(search): add google maps mapper with website normalization`
- `fix(auth): handle missing google metadata fallback`
- `chore(ci): pin actions to SHA`
- `docs: update CLAUDE.md for lib/supabase`

> **Nunca** use `--no-verify`, `--no-gpg-sign`, ou `git commit --amend` para sobrescrever história já pushada.

---

## Fluxo de PR (obrigatório)

Cada PR passa por **todos** os passos abaixo, sem exceção.

1. **Criar branch** a partir de `main`.
2. **TDD**: escrever teste(s) falhando primeiro.
3. **Implementar** até o teste passar.
4. **Refatorar** mantendo testes verdes.
5. **Atualizar `CLAUDE.md`** de toda pasta com arquivos novos ou modificados.
6. **Validar localmente**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run test:e2e
   ```
7. **Commit semântico** + push.
8. **Abrir PR** com `gh pr create` referenciando o issue (`Closes #N`). Use o template padrão.
9. **CI** roda automaticamente. Esperar verde antes de seguir.
10. **Code review**: rodar `sentry-skills:code-review` no diff e endereçar achados.
11. **Security review**: rodar `sentry-skills:security-review` no diff e endereçar achados.
12. **Squash merge** via `gh pr merge --squash --delete-branch`.

Issues fecham automaticamente via `Closes #N` no PR.

---

## Quality gates

Bloqueiam o merge:

| Gate | Comando | Critério |
|---|---|---|
| Lint | `npm run lint` | Zero warnings |
| Typecheck | `npx tsc --noEmit` | Zero erros |
| Unit | `npm test` | Todos verdes |
| Coverage | (CI) | ≥ 80% lines/functions, ≥ 75% branches em `lib/` e `app/api/` |
| E2E | `npm run test:e2e` | Verde para fluxos afetados |
| CI | (GitHub Actions) | 5 jobs verdes |
| Code review | `sentry-skills:code-review` | Achados endereçados |
| Security review | `sentry-skills:security-review` | Achados endereçados |
| CLAUDE.md | inspeção manual | Atualizado em pastas afetadas |

Sugestões menores (nice-to-have) podem ser endereçadas em follow-up issues, mas precisam estar registradas como comentários no PR ou issues novas.

---

## Onde escrever testes

| Tipo | Pasta | Quando usar |
|---|---|---|
| Unit | `tests/unit/` (espelha estrutura de `lib/`) | Funções puras, mappers, validators |
| Integration | `tests/unit/` (com mock de Supabase/Apify) | Server actions, API handlers, RTL de componentes |
| E2E | `tests/e2e/` | Fluxos do usuário (Playwright) |

Um teste novo, falhando, **antes** da implementação. Sem exceções para lógica de negócio.

---

## TDD na prática

Exemplo aplicado a um mapper Apify:

```ts
// 1. tests/unit/lib/apify/google-maps.test.ts (escrito PRIMEIRO)
import { describe, it, expect } from 'vitest';
import { mapGoogleMapsPlace } from '@/lib/apify/google-maps';
import fixture from './fixtures/google-maps-place.json';

describe('mapGoogleMapsPlace', () => {
  it('mapeia title para name e categoryName para category', () => {
    const lead = mapGoogleMapsPlace(fixture);
    expect(lead.name).toBe('Barbearia Bigode');
    expect(lead.category).toBe('Barbearia');
  });

  it('normaliza website (lower, sem protocolo, sem trailing slash)', () => {
    const lead = mapGoogleMapsPlace({ ...fixture, website: 'HTTPS://Bigode.com.br/' });
    expect(lead.website).toBe('bigode.com.br');
  });
});

// 2. lib/apify/google-maps.ts (implementação)
export function mapGoogleMapsPlace(p: GoogleMapsPlace): LeadInsert {
  // ...
}
```

---

## Onde está o quê

| Recurso | Local |
|---|---|
| Spec técnica do projeto | [`CLAUDE.md`](./CLAUDE.md) |
| Spec por pasta | `<pasta>/CLAUDE.md` |
| Backlog | [Issues](https://github.com/gasparellodev/gasp-search/issues) |
| Roadmap | Milestones (Phase 0–4) |
| Workflow CI | [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) |

---

## Código de conduta básico

- Seja direto e respeitoso em revisões.
- Não bloqueie PR por preferência estética; abra discussão para padrões novos.
- Documente decisões não óbvias inline (comentário `WHY`, não `WHAT`).
- Em caso de dúvida, abra Discussion antes de divergir do padrão.
