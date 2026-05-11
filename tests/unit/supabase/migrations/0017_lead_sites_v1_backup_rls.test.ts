/**
 * Tests para `supabase/migrations/0017_lead_sites_v1_backup_rls.sql` (issue #236).
 *
 * Sprint 0 follow-up de #235 (PR-C do épico SiteVariables v2). Migration
 * 0016 criou `lead_sites_v1_backup` via `CREATE TABLE ... AS` que não
 * herda RLS — esta migration fecha a porta com REVOKE + ENABLE RLS +
 * GRANT explícito pra service_role.
 *
 * Estratégia: string assertions no SQL (padrão clássico do projeto, CI
 * sem Postgres real). Cobre presença das estruturas-chave (REVOKEs,
 * ALTER ENABLE, GRANT, COMMENT) e ausência de anti-padrões (CREATE
 * POLICY, GRANT INSERT/UPDATE/DELETE/ALL).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    __dirname,
    "../../../../supabase/migrations/0017_lead_sites_v1_backup_rls.sql",
  ),
  "utf8",
);

// ===========================================================================
// SQL string assertions — estrutura da migration
// ===========================================================================

describe("migration 0017_lead_sites_v1_backup_rls — SQL structure", () => {
  it("header documenta dependência de 0016 (que cria a tabela)", () => {
    expect(sql).toMatch(/Requires:\s*0016_site_variables_v2\.sql/i);
  });

  it("header menciona issue #236 (rastreabilidade)", () => {
    expect(sql).toMatch(/#236/);
  });

  it("REVOKE ALL FROM PUBLIC (cobre grants implícitos)", () => {
    expect(sql).toMatch(
      /revoke all on public\.lead_sites_v1_backup from public/i,
    );
  });

  it("REVOKE ALL FROM anon (PostgREST default role)", () => {
    expect(sql).toMatch(
      /revoke all on public\.lead_sites_v1_backup from anon/i,
    );
  });

  it("REVOKE ALL FROM authenticated (logged-in user role)", () => {
    expect(sql).toMatch(
      /revoke all on public\.lead_sites_v1_backup from authenticated/i,
    );
  });

  it("ENABLE ROW LEVEL SECURITY (deny-all sem policies)", () => {
    expect(sql).toMatch(
      /alter table public\.lead_sites_v1_backup enable row level security/i,
    );
  });

  it("GRANT SELECT pra service_role (server-only rollback path)", () => {
    expect(sql).toMatch(
      /grant select on public\.lead_sites_v1_backup to service_role/i,
    );
  });

  it("COMMENT ON TABLE documenta intenção (deny-all + service_role)", () => {
    expect(sql).toMatch(/comment on table public\.lead_sites_v1_backup/i);
  });

  it("rollback documentado em comentário (DISABLE RLS + restaurar grants)", () => {
    expect(sql).toMatch(/Rollback/);
    expect(sql).toMatch(
      /ALTER TABLE public\.lead_sites_v1_backup DISABLE ROW LEVEL SECURITY/i,
    );
  });
});

// ===========================================================================
// SQL negative assertions — anti-padrões intencionalmente ausentes
// ===========================================================================

describe("migration 0017_lead_sites_v1_backup_rls — intentional absences", () => {
  // Filtra comentários SQL (linhas iniciadas com `--`) antes das asserções
  // negativas. Como o header da migration documenta as decisões em texto
  // (incluindo "Sem CREATE POLICY", "GRANT ALL" no rollback, etc.), o
  // regex sobre o SQL bruto encontraria essas menções e quebraria os
  // testes. Queremos validar a ausência *executável*, não textual.
  const executableSql = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("NÃO cria CREATE POLICY (deny-all deliberado pra anon/authenticated)", () => {
    // RLS ON + 0 policies = deny-all. Decisão validada pelo PO em #236:
    // backup só serve para rollback admin manual via service_role.
    // Adicionar policies abriria caminho indesejado.
    expect(executableSql).not.toMatch(/create policy/i);
  });

  it("NÃO concede GRANT INSERT (backup é read-only do ponto de vista da app)", () => {
    expect(executableSql).not.toMatch(
      /grant insert on public\.lead_sites_v1_backup/i,
    );
  });

  it("NÃO concede GRANT UPDATE (rollback usa UPDATE em lead_sites, não backup)", () => {
    expect(executableSql).not.toMatch(
      /grant update on public\.lead_sites_v1_backup/i,
    );
  });

  it("NÃO concede GRANT DELETE (preservação garantida)", () => {
    expect(executableSql).not.toMatch(
      /grant delete on public\.lead_sites_v1_backup/i,
    );
  });

  it("NÃO concede GRANT ALL (princípio do least privilege)", () => {
    expect(executableSql).not.toMatch(
      /grant all on public\.lead_sites_v1_backup/i,
    );
  });
});
