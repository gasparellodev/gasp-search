# `app/api/tags/` — Spec Técnica

## Propósito

CRUD REST de tags por usuário. RLS isola dados; unique
`(user_id, name)` é enforce no DB e refletido como **409** aqui.

## Endpoints

### `GET /api/tags`

Lista as tags do user logado, ordenadas por nome.

**Response:** `200 { data: { id, name, color }[] }`.

### `POST /api/tags`

Cria nova tag. Body: `{ name: string (2-40), color?: string (#RRGGBB) }`.

- **201** com `TagRow`.
- **400** body inválido.
- **409** quando já existe tag com o mesmo nome (unique constraint).
- **502** outras falhas.

### `PATCH /api/tags/[id]`

Atualiza name/color. Body parcial (pelo menos um campo).

- **200** com `TagRow`.
- **400** body inválido.
- **404** quando RLS bloqueia (tag não pertence ao user).
- **409** quando rename conflita com nome existente.

### `DELETE /api/tags/[id]`

Exclui tag. ON DELETE CASCADE remove `lead_tags` automaticamente.

- **204** No Content.
- **404** quando 0 rows.

## Regras de negócio

1. **`DuplicateTagError`** sinaliza Postgres `23505`. O handler converte
   em **409**. Outras falhas viram **502**.
2. **`PGRST116`** (no rows) em update vira **404** — `updateTag` retorna
   `null` neste caso.
3. **Color default** vem do schema (`#0ea5e9`) quando o body omite.

## Arquivos

| Path | Métodos | Propósito |
|---|---|---|
| `route.ts` | GET, POST | Lista + criação |
| `[id]/route.ts` | PATCH, DELETE | Mutação por id |

## Dependências

- `@/lib/leads/list-tags` (read-only)
- `@/lib/leads/tags-crud` (createTag, updateTag, deleteTag, DuplicateTagError)
- `@/lib/validators/tags` (createTagSchema, updateTagSchema)
- `@/lib/supabase/server`
