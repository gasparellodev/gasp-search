# `app/api/leads/` — Spec Técnica

## Propósito

CRUD REST de leads. Todos os handlers exigem sessão Supabase autenticada
e dependem de RLS para isolamento por `user_id`.

## Endpoints

### `GET /api/leads`

Lista paginada com filtros via query string.

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | Página (1-indexed) |
| `pageSize` | 25\|50\|100 | 25 | Itens por página |
| `sortBy` | name\|category\|city\|stage\|score\|created_at | created_at | Coluna de ordenação |
| `sortDir` | asc\|desc | desc | Direção |
| `q` | string ≥2 chars | — | Busca por `name` (ilike) |
| `stage` | enum | — | Filtra por estágio |
| `source` | enum | — | Filtra por origem |
| `hasWebsite` | true\|false | — | Tristate |
| `tagId` | string\[] | — | UUIDs (repetir key ou separar por vírgula). AND-of-tags via subquery em `lead_tags` |

**Response:** `200 { data: LeadListItem[], total, page, pageSize, totalPages }`.

Erros: `401 Não autenticado`, `502 Falha ao listar leads`.

### `POST /api/leads`

Cria lead manual. Body validado por `createLeadSchema`.
- `name` e `source` obrigatórios.
- `tagIds` aceitos no schema mas tratados em endpoint dedicado (#22).

**Response:** `201 LeadListItem`.

### `GET /api/leads/[id]`

Retorna lead único. RLS garante que só o dono enxerga.

**Response:** `200 LeadListItem` ou `404 Lead não encontrado`.

### `PATCH /api/leads/[id]`

Atualiza campos parciais via `updateLeadSchema`. Body com pelo menos um campo.

**Response:** `200 LeadListItem` ou `404` quando RLS bloqueia (lead de outro user).

### `DELETE /api/leads/[id]`

Exclui lead. Conta linhas afetadas para distinguir "não existe" de "RLS bloqueou".

**Response:** `204 No Content` ou `404`.

## Regras de negócio

1. **Auth check em todo handler** via `createServerSupabase().auth.getUser()`.
2. **RLS é a fonte da verdade.** Não filtrar `user_id` manualmente nas queries —
   o Postgres faz. PATCH/DELETE de lead alheio retorna 0 rows ⇒ 404.
3. **Validação Zod antes de qualquer side effect.**
4. **Mensagens de erro em PT-BR** com shape `{ error, issues? }`.
5. **`tagIds` em create/update é ignorado** aqui — gerido em endpoint dedicado
   (`/api/leads/[id]/tags`) na issue #22, para manter contratos isolados.

## Arquivos

| Path | Métodos | Propósito |
|---|---|---|
| `route.ts` | GET, POST | Lista paginada + criação manual |
| `[id]/route.ts` | GET, PATCH, DELETE | Detalhe e mutação por id |

## Dependências

- `@/lib/supabase/server` (createServerSupabase)
- `@/lib/leads/list-leads` (listLeads + tipos)
- `@/lib/leads/crud` (createLead, getLead, updateLead, deleteLead)
- `@/lib/validators/leads` (schemas)
