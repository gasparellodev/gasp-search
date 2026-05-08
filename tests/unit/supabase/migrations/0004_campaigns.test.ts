import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/0004_campaigns.sql"),
  "utf8",
);

describe("migration 0004_campaigns", () => {
  it("declara enum campaign_mode com 2 valores", () => {
    expect(sql).toMatch(/create type public\.campaign_mode as enum/);
    expect(sql).toContain("'template'");
    expect(sql).toContain("'ai_per_lead'");
  });

  it("declara enum campaign_status com 5 valores", () => {
    expect(sql).toMatch(/create type public\.campaign_status as enum/);
    for (const v of ["draft", "running", "completed", "failed", "cancelled"]) {
      expect(sql).toContain(`'${v}'`);
    }
  });

  it("declara enum campaign_target_status com 4 valores", () => {
    expect(sql).toMatch(/create type public\.campaign_target_status as enum/);
    for (const v of ["pending", "sent", "failed", "skipped"]) {
      expect(sql).toContain(`'${v}'`);
    }
  });

  it("cria tabela campaigns com FK auth.users e CHECK validando mode payload", () => {
    expect(sql).toMatch(/create table public\.campaigns/);
    expect(sql).toMatch(
      /user_id uuid not null references auth\.users\(id\) on delete cascade/,
    );
    expect(sql).toMatch(/constraint campaigns_mode_payload check/);
    expect(sql).toMatch(/mode = 'template' and template_text is not null/);
    expect(sql).toMatch(/mode = 'ai_per_lead' and ai_channel is not null/);
  });

  it("cria tabela campaign_targets com PK composta", () => {
    expect(sql).toMatch(/create table public\.campaign_targets/);
    expect(sql).toMatch(/primary key \(campaign_id, lead_id\)/);
    expect(sql).toMatch(
      /campaign_id uuid not null references public\.campaigns\(id\) on delete cascade/,
    );
    expect(sql).toMatch(
      /lead_id uuid not null references public\.leads\(id\) on delete cascade/,
    );
  });

  it("cria índices esperados", () => {
    expect(sql).toMatch(/create index campaigns_user_created_idx/);
    expect(sql).toMatch(/create index campaign_targets_status_idx/);
  });

  it("registra trigger updated_at em campaigns reusando tg_set_updated_at", () => {
    expect(sql).toMatch(/create trigger campaigns_set_updated_at/);
    expect(sql).toMatch(/execute function public\.tg_set_updated_at\(\)/);
  });

  it("habilita RLS nas duas tabelas e cria policies por user_id", () => {
    expect(sql).toMatch(
      /alter table public\.campaigns enable row level security/,
    );
    expect(sql).toMatch(
      /alter table public\.campaign_targets enable row level security/,
    );
    expect(sql).toMatch(/create policy "own campaigns"/);
    expect(sql).toMatch(/create policy "own campaign_targets"/);
    // targets isolados via subquery na campaign-mãe
    expect(sql).toMatch(/exists \(\s*select 1 from public\.campaigns c/);
  });
});
