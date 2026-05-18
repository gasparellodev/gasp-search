import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/0025_iara_sandbox.sql"),
  "utf8",
);

describe("migration 0025_iara_sandbox", () => {
  it("cria whatsapp_conversations com FK pra leads + auth.users e cascade", () => {
    expect(sql).toMatch(/create table public\.whatsapp_conversations/);
    expect(sql).toMatch(
      /lead_id uuid not null references public\.leads\(id\) on delete cascade/,
    );
    expect(sql).toMatch(
      /user_id uuid not null references auth\.users\(id\) on delete cascade/,
    );
    expect(sql).toMatch(/iara_version text not null/);
    expect(sql).toMatch(/is_sandbox boolean not null default true/);
  });

  it("cria iara_messages com check em role + index por (conversation_id, created_at)", () => {
    expect(sql).toMatch(/create table public\.iara_messages/);
    expect(sql).toMatch(/check \(role in \('user', 'assistant'\)\)/);
    expect(sql).toMatch(
      /create index iara_messages_conversation_idx[\s\S]*conversation_id, created_at/,
    );
  });

  it("cria iara_handoffs com check de priority em P0-P3", () => {
    expect(sql).toMatch(/create table public\.iara_handoffs/);
    expect(sql).toMatch(
      /check \(priority in \('P0', 'P1', 'P2', 'P3'\)\)/,
    );
    expect(sql).toMatch(/motivo text not null/);
    expect(sql).toMatch(/resolved_at timestamptz/);
  });

  it("cria iara_scheduled_followups e iara_demand_signals", () => {
    expect(sql).toMatch(/create table public\.iara_scheduled_followups/);
    expect(sql).toMatch(/create table public\.iara_demand_signals/);
    expect(sql).toMatch(/scheduled_for timestamptz not null/);
    expect(sql).toMatch(/feature_solicitada text not null/);
  });

  it("habilita RLS nas 5 tabelas novas", () => {
    const tables = [
      "whatsapp_conversations",
      "iara_messages",
      "iara_handoffs",
      "iara_scheduled_followups",
      "iara_demand_signals",
    ];
    for (const table of tables) {
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      );
    }
  });

  it("cria policies isolando por user_id (direto ou via conversa)", () => {
    expect(sql).toMatch(/create policy "own whatsapp_conversations"/);
    expect(sql).toMatch(/create policy "own iara_messages"/);
    expect(sql).toMatch(/create policy "own iara_handoffs"/);
    expect(sql).toMatch(/create policy "own iara_scheduled_followups"/);
    expect(sql).toMatch(/create policy "own iara_demand_signals"/);
    expect(sql).toMatch(/user_id = auth\.uid\(\)/);
  });

  it("registra trigger de updated_at em whatsapp_conversations", () => {
    expect(sql).toMatch(
      /create trigger whatsapp_conversations_set_updated_at/,
    );
    expect(sql).toMatch(/execute function public\.tg_set_updated_at\(\)/);
  });
});
