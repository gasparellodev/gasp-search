# Wave 0 — Supabase sync report (2026-05-12)

Durante a execução da Wave 0 do plano [`2026-05-12-finalize-all-open-issues-plan.md`](../plans/2026-05-12-finalize-all-open-issues-plan.md), foi detectado que o projeto Supabase `pvazzozzqwwshgacmafv` (gasp-search) estava com 6 migrations não aplicadas:

| Migration | Conteúdo | PR de origem |
|---|---|---|
| 0016_site_variables_v2 | Migra `lead_sites.variables` v1 flat → v2 nested + função PL/pgSQL + tabela `lead_sites_v1_backup` | #197 (Phase 7 / PR-C) |
| 0017_lead_sites_v1_backup_rls | Hardening de `lead_sites_v1_backup` (RLS deny-all, service_role-only) | #236 |
| 0018_lead_sites_signed_at | Coluna `signed_at timestamptz` + index parcial | #199 |
| 0019_lead_sites_visual_identity | Coluna `visual_identity jsonb` + buckets `visual-identity` (público) e `tradein-photos` (privado) + policies | #215 (#A1) |
| 0020_lead_form_submissions | Tabela `lead_form_submissions` + RLS owner_select | #223 (#H3) |
| 0021_consent_logs | Tabela `consent_logs` + RLS owner_select | #234 |

## Causa raiz (hipótese)

Migrations eram aplicadas via Dashboard SQL Editor manualmente (per `supabase/CLAUDE.md`), não via `npx supabase db push` ou Supabase MCP `apply_migration`. Em algum momento Phase 7 esse fluxo manual foi pulado nas mergeagens dos PRs 0016-0021.

Para evitar reincidência: **automatizar aplicação via Supabase MCP no fluxo de merge** ou adicionar step de CI que valida `list_migrations` contém todas as `supabase/migrations/*.sql`.

## Aplicação feita

Todas as 6 migrations foram aplicadas via Supabase MCP `apply_migration` em 2026-05-12 02:50 UTC-3. Idempotentes — re-run não causa efeito colateral.

Validação:
- `pg_tables` lista 14 tabelas em `public` (esperado).
- `storage.buckets` lista `tradein-photos` (privado) e `visual-identity` (público).
- `lead_sites.signed_at` e `lead_sites.visual_identity` presentes.
- 1 row de `lead_sites` migrado para shape v2 (variables agora tem `schema_version: 2`).

## Achados de security advisors

`mcp__supabase__get_advisors --type security` retornou 9 lints:

| # | Lint | Level | Detalhe | Tratamento |
|---|---|---|---|---|
| 1 | `rls_enabled_no_policy` | INFO | `lead_sites_v1_backup` (RLS sem policy) | **Esperado** — deny-all by design (per migration 0017). |
| 2 | `function_search_path_mutable` | WARN | `tg_set_updated_at` | **Legado de 0001_init**. Não-bloqueante; pode ser corrigido em PR follow-up adicionando `SET search_path = public`. |
| 3 | `function_search_path_mutable` | WARN | `__migrate_site_variables_v1_to_v2` | **CORRIGIDO** via migration `0016_site_variables_v2_search_path_fix` (pin `set search_path = public`). |
| 4 | `public_bucket_allows_listing` | WARN | `visual-identity` SELECT policy permite listing | **Pre-existente do design 0019**. Mitigação: como bucket é só leitura de URLs específicos (consumidos por `<Image>` em SSR), o listing não expõe surface real. Decisão V2: trocar policy para `using (false)` e gerar signed URLs em SSR. |
| 5-6 | `anon_security_definer_function_executable` | WARN | `handle_new_user` e `rls_auto_enable` executáveis via `/rest/v1/rpc/` | **Legado de 0001_init**. Funções são triggers (não devem ser callable via RPC). Mitigação V2: `revoke execute on function ... from anon, authenticated;` |
| 7-8 | `authenticated_security_definer_function_executable` | WARN | mesmas funções | (idem) |
| 9 | `auth_leaked_password_protection` | WARN | HaveIBeenPwned check disabled no Supabase Auth | Habilitar via Dashboard → Authentication → Password protection. |

**Resumo**: achados são todos pré-existentes ou intencionais. Único achado novo (do trabalho atual) foi corrigido. Recomendado abrir issue Phase 8 "Database security hardening" para tratar 2-9 acima.

## Próximos passos

Wave 0 prossegue para Step 0.6 (commit + PR de housekeeping). Waves 1-6 podem rodar normalmente — o banco está sincronizado.
