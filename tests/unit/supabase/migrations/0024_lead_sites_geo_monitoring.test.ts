import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0024_lead_sites_geo_monitoring.sql",
  ),
  "utf8",
);

describe("migration 0024 — lead_sites_geo_monitoring", () => {
  it("cria a tabela com IF NOT EXISTS (idempotente)", () => {
    expect(sql).toMatch(
      /create table if not exists public\.lead_sites_geo_monitoring/i,
    );
  });

  it("declara FK lead_site_id → lead_sites(id) ON DELETE CASCADE", () => {
    expect(sql).toMatch(
      /lead_site_id uuid not null references public\.lead_sites\(id\) on delete cascade/i,
    );
  });

  it("declara check constraint para source ('perplexity', 'chatgpt', 'mock')", () => {
    expect(sql).toMatch(/check \(source in \('perplexity', 'chatgpt', 'mock'\)\)/i);
  });

  it("cria índice por (lead_site_id, checked_at desc) para queries de histórico", () => {
    expect(sql).toMatch(
      /create index if not exists lead_sites_geo_monitoring_site_idx\s+on public\.lead_sites_geo_monitoring \(lead_site_id, checked_at desc\)/i,
    );
  });

  it("habilita RLS na tabela", () => {
    expect(sql).toMatch(
      /alter table public\.lead_sites_geo_monitoring enable row level security/i,
    );
  });

  it("cria policy de acesso exclusivo para service_role", () => {
    expect(sql).toMatch(/auth\.role\(\) = 'service_role'/i);
  });

  it("adiciona comment na tabela referenciando a issue #G5", () => {
    expect(sql).toMatch(/comment on table public\.lead_sites_geo_monitoring/i);
    expect(sql).toMatch(/#G5/i);
  });
});
