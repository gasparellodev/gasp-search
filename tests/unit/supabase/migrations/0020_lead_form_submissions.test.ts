/**
 * Validates SQL content of migration `0020_lead_form_submissions.sql`
 * (Phase 7 / Sprint 4 / H3 — issue #223).
 *
 * CI não roda Postgres real; testes inspecionam o SQL plain pra
 * garantir presença de table/indexes/RLS policy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SQL_PATH = join(
  process.cwd(),
  "supabase/migrations/0020_lead_form_submissions.sql",
);
const sql = readFileSync(SQL_PATH, "utf-8");

describe("migration 0020_lead_form_submissions.sql", () => {
  it("cria tabela lead_form_submissions", () => {
    expect(sql).toMatch(/create table public\.lead_form_submissions/i);
  });

  it("tem PK uuid com default gen_random_uuid", () => {
    expect(sql).toMatch(/id\s+uuid primary key default gen_random_uuid\(\)/i);
  });

  it("FK user_id → auth.users com ON DELETE CASCADE", () => {
    expect(sql).toMatch(
      /user_id\s+uuid not null references auth\.users\(id\) on delete cascade/i,
    );
  });

  it("FK lead_site_id → lead_sites com ON DELETE CASCADE", () => {
    expect(sql).toMatch(
      /lead_site_id\s+uuid not null references public\.lead_sites\(id\) on delete cascade/i,
    );
  });

  it("campos obrigatórios: name, phone, email, consent_text", () => {
    expect(sql).toMatch(/name\s+text not null/i);
    expect(sql).toMatch(/phone\s+text not null/i);
    expect(sql).toMatch(/email\s+text not null/i);
    expect(sql).toMatch(/consent_text\s+text not null/i);
  });

  it("campos LGPD audit opcionais: consent_ip (inet), consent_user_agent", () => {
    expect(sql).toMatch(/consent_ip\s+inet/i);
    expect(sql).toMatch(/consent_user_agent\s+text/i);
  });

  it("consent_timestamp NOT NULL com default now()", () => {
    expect(sql).toMatch(/consent_timestamp\s+timestamptz not null default now\(\)/i);
  });

  it("campos opcionais: message, model", () => {
    expect(sql).toMatch(/message\s+text(?!\s+not null)/i);
    expect(sql).toMatch(/model\s+text(?!\s+not null)/i);
  });

  it("índice composto pra rate-limit (consent_ip + created_at DESC)", () => {
    expect(sql).toMatch(
      /create index idx_lead_form_submissions_ip_created[\s\S]+consent_ip.*created_at desc/i,
    );
  });

  it("índice secundário user_id pra listagem futura", () => {
    expect(sql).toMatch(/create index idx_lead_form_submissions_user/i);
  });

  it("ativa RLS na tabela", () => {
    expect(sql).toMatch(
      /alter table public\.lead_form_submissions enable row level security/i,
    );
  });

  it("policy SELECT permite apenas owner (auth.uid() = user_id)", () => {
    expect(sql).toMatch(
      /create policy lead_form_submissions_owner_select[\s\S]+auth\.uid\(\)\s*=\s*user_id/i,
    );
  });
});
