import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0021_consent_logs.sql"),
  "utf8",
);

describe("migration 0021 — consent_logs", () => {
  it("cria tabela consent_logs com campos de auditoria LGPD", () => {
    expect(sql).toMatch(/create table public\.consent_logs/i);
    expect(sql).toMatch(/user_id\s+uuid/i);
    expect(sql).toMatch(/ip\s+inet/i);
    expect(sql).toMatch(/user_agent\s+text/i);
    expect(sql).toMatch(/timestamp\s+timestamptz\s+not null/i);
    expect(sql).toMatch(/consent_text\s+text\s+not null/i);
    expect(sql).toMatch(/version\s+text\s+not null/i);
    expect(sql).toMatch(/action\s+text\s+not null/i);
    expect(sql).toMatch(/categories\s+jsonb\s+not null/i);
  });

  it("valida ações permitidas e habilita RLS", () => {
    expect(sql).toMatch(/accept_all/i);
    expect(sql).toMatch(/accept_selected/i);
    expect(sql).toMatch(/reject/i);
    expect(sql).toMatch(/alter table public\.consent_logs enable row level security/i);
  });

  it("inclui índices para consulta por user e timestamp", () => {
    expect(sql).toMatch(/create index .*consent_logs_user/i);
    expect(sql).toMatch(/create index .*consent_logs_timestamp/i);
  });
});
