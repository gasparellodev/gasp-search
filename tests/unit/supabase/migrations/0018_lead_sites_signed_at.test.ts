/**
 * Tests para `supabase/migrations/0018_lead_sites_signed_at.sql` (issue #199).
 *
 * Sprint 0 / #F2 SEO foundation. Adiciona coluna `signed_at timestamptz`
 * em `lead_sites` + index parcial para queries de sitemap. Habilita o
 * gate `isIndexable(site)` em `lib/sites/metadata.ts`.
 *
 * Estratégia: string assertions no SQL (padrão clássico do projeto, CI
 * sem Postgres real). Cobre presença das estruturas-chave (ADD COLUMN,
 * CREATE INDEX, COMMENT) e idempotência (`IF NOT EXISTS`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    __dirname,
    "../../../../supabase/migrations/0018_lead_sites_signed_at.sql",
  ),
  "utf8",
);

// ===========================================================================
// SQL string assertions — estrutura da migration
// ===========================================================================

describe("migration 0018_lead_sites_signed_at — SQL structure", () => {
  it("header documenta dependência de 0010 (cria a tabela)", () => {
    expect(sql).toMatch(/Requires:\s*0010_lead_sites\.sql/i);
  });

  it("header menciona issue #199 (rastreabilidade)", () => {
    expect(sql).toMatch(/#199/);
  });

  it("ADD COLUMN IF NOT EXISTS signed_at timestamptz (idempotent)", () => {
    expect(sql).toMatch(
      /alter table public\.lead_sites[\s\S]*?add column if not exists signed_at timestamptz/i,
    );
  });

  it("CREATE INDEX IF NOT EXISTS lead_sites_signed_at_idx (idempotent)", () => {
    expect(sql).toMatch(
      /create index if not exists lead_sites_signed_at_idx/i,
    );
  });

  it("index é parcial: WHERE signed_at IS NOT NULL", () => {
    expect(sql).toMatch(/where signed_at is not null/i);
  });

  it("COMMENT ON COLUMN documenta semântica (distinto de published_at/sent_at)", () => {
    expect(sql).toMatch(/comment on column public\.lead_sites\.signed_at/i);
    expect(sql).toMatch(/published_at/i);
    expect(sql).toMatch(/sent_at/i);
  });

  it("rollback documentado em comentário (DROP INDEX + DROP COLUMN)", () => {
    expect(sql).toMatch(/Rollback/i);
    expect(sql).toMatch(/drop index if exists lead_sites_signed_at_idx/i);
    expect(sql).toMatch(
      /alter table public\.lead_sites drop column if exists signed_at/i,
    );
  });
});

// ===========================================================================
// SQL negative assertions — anti-padrões intencionalmente ausentes
// ===========================================================================

describe("migration 0018_lead_sites_signed_at — intentional absences", () => {
  // Filtra comentários SQL (linhas iniciadas com `--`) antes das asserções
  // negativas. O header documenta as decisões (incluindo rollback com DROP
  // COLUMN) em texto — queremos validar ausência *executável*, não textual.
  const executableSql = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("NÃO define DEFAULT na coluna (signed_at nasce NULL — backfill é decisão de produto)", () => {
    expect(executableSql).not.toMatch(/signed_at[^,;]*default/i);
  });

  it("NÃO faz UPDATE de backfill (admin marca manualmente em V1)", () => {
    expect(executableSql).not.toMatch(
      /update public\.lead_sites[\s\S]*?set\s+signed_at/i,
    );
  });

  it("NÃO declara NOT NULL (compatibilidade com rows legadas)", () => {
    // A coluna deve permanecer nullable — só assertamos que o ADD COLUMN
    // não inclui `NOT NULL` na mesma cláusula.
    expect(executableSql).not.toMatch(
      /add column if not exists signed_at timestamptz[^;]*not null/i,
    );
  });
});
