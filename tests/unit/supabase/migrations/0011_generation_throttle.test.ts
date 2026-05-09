import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Migration 0011_generation_throttle — issue #159 (Phase 7 M1.7).
//
// Estratégia de teste: assertions sobre o conteúdo do SQL da migration
// (mesmo padrão usado em 0001..0010). O CI do projeto não roda Postgres
// real; cenários integrados são validados via inspeção do SQL.
//
// AC12 da issue #159:
//   - Migration aplica clean (verificado via lint do SQL e ausência de
//     constructs deprecated/inválidos).
//   - RLS policies isolam usuários (`auth.uid() = user_id`).
//   - Index `(user_id, attempted_at desc)` presente para perf da query
//     de rate-limit.

const sql = readFileSync(
  resolve(
    __dirname,
    "../../../../supabase/migrations/0011_generation_throttle.sql",
  ),
  "utf8",
);

describe("migration 0011_generation_throttle", () => {
  describe("schema da tabela generation_throttle", () => {
    it("cria tabela public.generation_throttle", () => {
      expect(sql).toMatch(/create table public\.generation_throttle/);
    });

    it("define id como uuid primary key default gen_random_uuid", () => {
      expect(sql).toMatch(/id\s+uuid primary key default gen_random_uuid\(\)/);
    });

    it("define user_id com FK auth.users on delete cascade", () => {
      expect(sql).toMatch(
        /user_id\s+uuid not null references auth\.users\(id\) on delete cascade/,
      );
    });

    it("define attempted_at como timestamptz not null default now()", () => {
      expect(sql).toMatch(
        /attempted_at\s+timestamptz not null default now\(\)/,
      );
    });
  });

  describe("índice composto (user_id, attempted_at desc) — AC12", () => {
    it("cria índice generation_throttle_user_time", () => {
      expect(sql).toMatch(
        /create index generation_throttle_user_time\s+on public\.generation_throttle\(user_id, attempted_at desc\)/,
      );
    });
  });

  describe("RLS — isolamento por usuário (AC4)", () => {
    it("habilita RLS em generation_throttle", () => {
      expect(sql).toMatch(
        /alter table public\.generation_throttle enable row level security/,
      );
    });

    it("cria policy SELECT por auth.uid() = user_id (cada user só vê suas tentativas)", () => {
      expect(sql).toMatch(/create policy "?throttle_select_own"?/);
      expect(sql).toMatch(/for select using \(auth\.uid\(\) = user_id\)/);
    });

    it("cria policy INSERT por auth.uid() = user_id (registra tentativa do próprio user)", () => {
      expect(sql).toMatch(/create policy "?throttle_insert_own"?/);
      expect(sql).toMatch(/for insert with check \(auth\.uid\(\) = user_id\)/);
    });

    it("não declara policy permissive para service_role (Supabase bypassa RLS)", () => {
      // O orquestrador `generateLeadSite` (#159) usa `service_role` para
      // bypassar RLS na contagem da janela e no insert da tentativa —
      // policies só governam o caminho `anon`/`authenticated`.
      expect(sql).not.toMatch(/to service_role/);
    });
  });
});
