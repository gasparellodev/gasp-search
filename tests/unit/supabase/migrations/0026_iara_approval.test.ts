import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/0026_iara_approval.sql"),
  "utf8",
);

describe("migration 0026_iara_approval", () => {
  it("adiciona approval_status com check constraint canônica", () => {
    expect(sql).toMatch(
      /add column approval_status text not null default 'pending'/,
    );
    expect(sql).toMatch(
      /check \(approval_status in \('pending', 'approved', 'rejected'\)\)/,
    );
  });

  it("adiciona approval_notes, reviewed_at e reviewed_by", () => {
    expect(sql).toMatch(/add column approval_notes text/);
    expect(sql).toMatch(/add column reviewed_at timestamptz/);
    expect(sql).toMatch(
      /add column reviewed_by uuid references auth\.users\(id\) on delete set null/,
    );
  });

  it("cria índice composto pra dashboard de revisão", () => {
    expect(sql).toMatch(
      /create index whatsapp_conversations_approval_idx[\s\S]*user_id, approval_status, last_message_at desc nulls last/,
    );
  });

  it("alvo único é whatsapp_conversations (não toca outras tabelas)", () => {
    const alterMatches = sql.match(/alter table [\w.]+/g) ?? [];
    expect(alterMatches.length).toBeGreaterThan(0);
    for (const m of alterMatches) {
      expect(m).toMatch(/alter table public\.whatsapp_conversations/);
    }
  });

  it("documenta cada coluna nova com comment on column", () => {
    expect(sql).toMatch(
      /comment on column public\.whatsapp_conversations\.approval_status/,
    );
    expect(sql).toMatch(
      /comment on column public\.whatsapp_conversations\.approval_notes/,
    );
    expect(sql).toMatch(
      /comment on column public\.whatsapp_conversations\.reviewed_at/,
    );
    expect(sql).toMatch(
      /comment on column public\.whatsapp_conversations\.reviewed_by/,
    );
  });
});
