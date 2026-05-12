import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0022_evolution_instance_nanoid_slug.sql"),
  "utf8",
);

describe("migration 0022 — evolution_instance_nanoid_slug", () => {
  it("adiciona coluna evo_instance_v2 idempotente", () => {
    expect(sql).toMatch(
      /alter table public\.whatsapp_instances\s+add column if not exists evo_instance_v2 text/i,
    );
  });

  it("backfill usa gen_random_bytes(8) hex (16 chars, ~64 bits)", () => {
    expect(sql).toMatch(
      /update public\.whatsapp_instances[\s\S]+set evo_instance_v2 = encode\(gen_random_bytes\(8\), 'hex'\)[\s\S]+where evo_instance_v2 is null/i,
    );
  });

  it("aplica NOT NULL + UNIQUE em evo_instance_v2 após backfill", () => {
    expect(sql).toMatch(
      /alter table public\.whatsapp_instances\s+alter column evo_instance_v2 set not null/i,
    );
    expect(sql).toMatch(
      /create unique index if not exists whatsapp_instances_evo_instance_v2_uniq[\s\S]+on public\.whatsapp_instances \(evo_instance_v2\)/i,
    );
  });

  it("marca evo_instance legado como DEPRECATED com referência ao issue #130", () => {
    expect(sql).toMatch(
      /comment on column public\.whatsapp_instances\.evo_instance is\s+'DEPRECATED:[^']*#130[^']*'/i,
    );
  });
});
