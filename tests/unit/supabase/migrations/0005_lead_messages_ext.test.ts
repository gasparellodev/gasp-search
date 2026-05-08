import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/0005_lead_messages_ext.sql"),
  "utf8",
);

describe("migration 0005_lead_messages_ext", () => {
  it("declara enum lead_message_direction (outbound, inbound)", () => {
    expect(sql).toMatch(/create type public\.lead_message_direction as enum/);
    expect(sql).toContain("'outbound'");
    expect(sql).toContain("'inbound'");
  });

  it("declara enum lead_message_status com 5 valores", () => {
    expect(sql).toMatch(/create type public\.lead_message_status as enum/);
    for (const v of ["queued", "sent", "delivered", "read", "failed"]) {
      expect(sql).toContain(`'${v}'`);
    }
  });

  it("adiciona 6 colunas em lead_messages com defaults preservando registros antigos", () => {
    expect(sql).toMatch(/alter table public\.lead_messages/);
    // Defaults pra registros antigos (mensagens IA já geradas):
    // direction='outbound', status='sent' (foram exibidas, mesmo sem trafegar),
    // ai_generated=false (não distinguia antes da Phase 5).
    expect(sql).toMatch(
      /add column direction public\.lead_message_direction not null default 'outbound'/,
    );
    expect(sql).toMatch(
      /add column status public\.lead_message_status not null default 'sent'/,
    );
    expect(sql).toMatch(/add column whatsapp_msg_id text unique/);
    expect(sql).toMatch(
      /add column campaign_id uuid references public\.campaigns\(id\) on delete set null/,
    );
    expect(sql).toMatch(/add column error_message text/);
    expect(sql).toMatch(
      /add column ai_generated boolean not null default false/,
    );
  });

  it("cria índice parcial para queries de outbound", () => {
    expect(sql).toMatch(/create index lead_messages_user_status_idx/);
    expect(sql).toMatch(/where direction = 'outbound'/);
  });

  it("liga campaign_targets.sent_message_id a lead_messages via FK", () => {
    expect(sql).toMatch(
      /alter table public\.campaign_targets\s+add constraint campaign_targets_sent_message_id_fkey/,
    );
    expect(sql).toMatch(
      /foreign key \(sent_message_id\)\s+references public\.lead_messages\(id\)/,
    );
    expect(sql).toMatch(/on delete set null/);
  });
});
