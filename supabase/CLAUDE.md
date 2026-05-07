# `supabase/` — Spec Técnica

## Propósito

Migrations SQL versionadas que definem o schema do banco. Aplicado via Supabase CLI (local) ou SQL Editor (remoto).

## Como adicionar

- **Nova migration**: arquivo `migrations/NNNN_<nome>.sql` com `NNNN` = próximo número de 4 dígitos. Nunca editar migrations já aplicadas.
- **Idempotência preferida**: use `create extension if not exists`, `create table if not exists` quando aplicável (mas para schema inicial, queremos falhar duro se já existir).
- **RLS sempre habilitada** em qualquer tabela com dados de usuário. Default: `using (user_id = auth.uid())`.
- **Triggers** em arquivo separado se complexos; pequenos podem ficar inline na migration.

## Regras de negócio

1. **RLS é a defesa primária**, não opcional. Tabelas sem RLS expõem todos os dados ao `anon`. **Nunca** desabilitar RLS por conveniência.
2. **Multi-tenant por usuário**: toda tabela referencia `auth.users(id) on delete cascade`. Sem `user_id`, sem isolamento.
3. **Dedup de leads** via unique index parcial: `unique (user_id, source, website) where website is not null`. Evita falha em rows com NULL.
4. **Triggers `security definer`** (como `handle_new_user`) precisam de `set search_path = public` para evitar search-path injection.
5. **Enums** versionados. Adição: `alter type ... add value`. Remoção exige migration nova (não edite o tipo existente).
6. **`updated_at` auto-managed** via `tg_set_updated_at()` trigger. Não mexer manualmente em código de aplicação.

## Aplicar migration

### Remoto (produção / staging)

1. Abrir Supabase Dashboard → SQL Editor.
2. Colar conteúdo de `migrations/0001_init.sql` e executar.
3. Verificar:
   ```sql
   select tablename from pg_tables where schemaname='public';
   select table_name, row_security from information_schema.tables
   where table_schema='public';
   ```
4. Regenerar tipos:
   ```bash
   npx supabase gen types typescript --project-id <ref> > types/database.ts
   ```

### Local (dev rápido)

```bash
npx supabase start
npx supabase db push    # aplica migrations
npx supabase gen types typescript --local > types/database.ts
```

## Validar RLS (manual, recomendado antes de Fase 2)

1. Criar 2 usuários de teste no Supabase Auth (ou via signup na app).
2. Como user A, inserir um lead direto via SQL Editor (com `auth.uid()` setado).
3. Como user B, tentar `select * from leads`. Deve retornar zero rows.
4. Como user B, tentar `update` no lead de A. Deve falhar com RLS.

## Arquivos

| Path | Propósito |
|---|---|
| `migrations/0001_init.sql` | Schema inicial: 6 tabelas, 3 enums, 6 RLS policies, 2 triggers, 5 índices/uniques |

## Dependências

- `pgcrypto` (extensão para `gen_random_uuid()`)
- `auth` schema (Supabase Auth — user `auth.users`)

## Quando atualizar este `CLAUDE.md`

- Nova migration adiciona conceito (view, função RPC, RLS por role).
- Pattern de RLS muda.
- Estratégia de dedup muda.
