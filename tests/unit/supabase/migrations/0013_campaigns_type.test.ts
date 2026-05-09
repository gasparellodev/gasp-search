import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/0013_campaigns_type.sql"),
  "utf8",
);

describe("migration 0013_campaigns_type (#172)", () => {
  it("adiciona coluna `type` em campaigns com default 'message' e NOT NULL", () => {
    expect(sql).toMatch(
      /alter table public\.campaigns\s+add column type text not null default 'message'/i,
    );
  });

  it("adiciona check constraint cobrindo 'message' e 'site_preview'", () => {
    expect(sql).toContain("campaigns_type_check");
    expect(sql).toMatch(/check\s*\(\s*type in \('message', 'site_preview'\)\s*\)/);
  });

  it("cria index parcial filtrado por type='site_preview' em (user_id, created_at desc)", () => {
    expect(sql).toContain("campaigns_user_type_site_preview_idx");
    expect(sql).toMatch(/where type = 'site_preview'/);
    expect(sql).toMatch(/user_id, created_at desc/);
  });

  it("não usa enum (escolha intencional pra evolução sem alter type)", () => {
    expect(sql).not.toMatch(/create type .*campaigns_type/i);
    expect(sql).not.toMatch(/alter type .*campaigns_type/i);
  });
});
