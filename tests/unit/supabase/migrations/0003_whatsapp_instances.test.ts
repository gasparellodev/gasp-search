import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/0003_whatsapp_instances.sql"),
  "utf8",
);

describe("migration 0003_whatsapp_instances", () => {
  it("declara o enum whatsapp_status com os 5 valores esperados", () => {
    expect(sql).toMatch(/create type public\.whatsapp_status as enum/);
    for (const value of [
      "disconnected",
      "qr_pending",
      "connecting",
      "connected",
      "error",
    ]) {
      expect(sql).toContain(`'${value}'`);
    }
  });

  it("cria a tabela whatsapp_instances com user_id UNIQUE FK auth.users", () => {
    expect(sql).toMatch(/create table public\.whatsapp_instances/);
    expect(sql).toMatch(
      /user_id uuid not null unique references auth\.users\(id\) on delete cascade/,
    );
  });

  it("inclui colunas evo_instance, status, phone_number, qr_code, last_seen_at", () => {
    expect(sql).toMatch(/evo_instance text not null/);
    expect(sql).toMatch(/status public\.whatsapp_status not null default 'disconnected'/);
    expect(sql).toMatch(/phone_number text/);
    expect(sql).toMatch(/qr_code text/);
    expect(sql).toMatch(/last_seen_at timestamptz/);
  });

  it("registra trigger de updated_at reusando tg_set_updated_at", () => {
    expect(sql).toMatch(/create trigger whatsapp_instances_set_updated_at/);
    expect(sql).toMatch(/execute function public\.tg_set_updated_at\(\)/);
  });

  it("habilita RLS e cria policy own whatsapp_instance", () => {
    expect(sql).toMatch(
      /alter table public\.whatsapp_instances enable row level security/,
    );
    expect(sql).toMatch(/create policy "own whatsapp_instance"/);
    expect(sql).toMatch(/using \(user_id = auth\.uid\(\)\)/);
    expect(sql).toMatch(/with check \(user_id = auth\.uid\(\)\)/);
  });
});
