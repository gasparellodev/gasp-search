/**
 * Tests para `supabase/migrations/0019_lead_sites_visual_identity.sql` (issue #215).
 *
 * Sprint 2 #A1 — foundation pra Sprint 2 #A2 (#216 generateVisualIdentity)
 * e #A3 (#217 admin regenerate UI). Migration adiciona:
 *   1. Coluna `lead_sites.visual_identity jsonb DEFAULT NULL`
 *   2. Bucket Storage `visual-identity` (PUBLIC — banners de marketing)
 *   3. Bucket Storage `tradein-photos` (PRIVADO, LGPD-safe)
 *   4. Policies SELECT/INSERT/UPDATE/DELETE para `visual-identity`
 *   5. ZERO policies para `tradein-photos` (deny-all deliberado)
 *
 * Estratégia: string assertions no SQL (padrão clássico do projeto, CI
 * sem Postgres real, per `tests/CLAUDE.md`). Positives + negatives — o
 * negative test para `tradein-photos` policies é a defesa primária
 * contra regressões LGPD (placas visíveis nas fotos).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    __dirname,
    "../../../../supabase/migrations/0019_lead_sites_visual_identity.sql",
  ),
  "utf8",
);

// Filtra comentários SQL antes das asserções negativas. O header da
// migration documenta as decisões em texto (incluindo menções a "policy"
// no exemplo V2 e no rollback) — queremos validar ausência *executável*,
// não textual.
const executableSql = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

// ===========================================================================
// SQL string assertions — estrutura da migration
// ===========================================================================

describe("migration 0019_lead_sites_visual_identity — SQL structure", () => {
  it("header documenta dependência de 0010 (cria a tabela lead_sites)", () => {
    expect(sql).toMatch(/Requires:\s*0010_lead_sites\.sql/i);
  });

  it("header menciona issue #215 (rastreabilidade)", () => {
    expect(sql).toMatch(/#215/);
  });

  it("ADD COLUMN IF NOT EXISTS visual_identity jsonb (idempotent)", () => {
    expect(sql).toMatch(
      /alter table public\.lead_sites[\s\S]*?add column if not exists visual_identity jsonb/i,
    );
  });

  it("coluna nasce com DEFAULT NULL (admin gera sob demanda em #216)", () => {
    expect(sql).toMatch(
      /add column if not exists visual_identity jsonb default null/i,
    );
  });

  it("COMMENT ON COLUMN documenta shape + referência Zod schema", () => {
    expect(sql).toMatch(
      /comment on column public\.lead_sites\.visual_identity/i,
    );
    expect(sql).toMatch(/VisualIdentityManifestSchema/i);
  });

  it("INSERT bucket `visual-identity` com public=true + ON CONFLICT DO NOTHING", () => {
    expect(sql).toMatch(
      /insert into storage\.buckets[\s\S]*?'visual-identity'[\s\S]*?true[\s\S]*?on conflict \(id\) do nothing/i,
    );
  });

  it("INSERT bucket `tradein-photos` com public=false (LGPD) + ON CONFLICT DO NOTHING", () => {
    expect(sql).toMatch(
      /insert into storage\.buckets[\s\S]*?'tradein-photos'[\s\S]*?false[\s\S]*?on conflict \(id\) do nothing/i,
    );
  });
});

describe("migration 0019 — visual-identity policies (public read + service_role mutations)", () => {
  it("DROP POLICY IF EXISTS antes de CREATE (idempotência canônica)", () => {
    expect(executableSql).toMatch(
      /drop policy if exists visual_identity_public_read on storage\.objects/i,
    );
  });

  it("CREATE POLICY SELECT pública (bucket_id = 'visual-identity')", () => {
    expect(executableSql).toMatch(
      /create policy visual_identity_public_read[\s\S]*?for select[\s\S]*?using \(bucket_id = 'visual-identity'\)/i,
    );
  });

  it("CREATE POLICY INSERT gated em service_role", () => {
    expect(executableSql).toMatch(
      /create policy visual_identity_service_role_insert[\s\S]*?for insert[\s\S]*?with check \(bucket_id = 'visual-identity' and auth\.role\(\) = 'service_role'\)/i,
    );
  });

  it("CREATE POLICY UPDATE gated em service_role (using + with check)", () => {
    expect(executableSql).toMatch(
      /create policy visual_identity_service_role_update[\s\S]*?for update[\s\S]*?using \(bucket_id = 'visual-identity' and auth\.role\(\) = 'service_role'\)[\s\S]*?with check \(bucket_id = 'visual-identity' and auth\.role\(\) = 'service_role'\)/i,
    );
  });

  it("CREATE POLICY DELETE gated em service_role", () => {
    expect(executableSql).toMatch(
      /create policy visual_identity_service_role_delete[\s\S]*?for delete[\s\S]*?using \(bucket_id = 'visual-identity' and auth\.role\(\) = 'service_role'\)/i,
    );
  });
});

// ===========================================================================
// SQL negative assertions — defense-in-depth pra `tradein-photos`
// ===========================================================================

describe("migration 0019 — tradein-photos policies (deny-all LGPD-safe)", () => {
  it("NÃO cria CREATE POLICY mencionando 'tradein-photos' (deny-all V1)", () => {
    // Decisão LGPD-safe: fotos de carros pessoais com placas visíveis +
    // dados pessoais → ZERO policies em storage.objects pra este bucket.
    // Apenas service_role bypassa (admin gera signed URLs server-side).
    // Adicionar policy aqui abriria caminho indesejado — defesa contra
    // regressão de privacidade.
    const tradeinPolicyPattern =
      /create policy[\s\S]*?'tradein-photos'/i;
    expect(executableSql).not.toMatch(tradeinPolicyPattern);
  });

  it("NÃO cria policy SELECT pra `tradein-photos` (deny-all anonymous reads)", () => {
    const selectPolicyOnTradein =
      /create policy[\s\S]*?for select[\s\S]*?bucket_id = 'tradein-photos'/i;
    expect(executableSql).not.toMatch(selectPolicyOnTradein);
  });

  it("NÃO cria policy INSERT pra `tradein-photos` (apenas service_role)", () => {
    const insertPolicyOnTradein =
      /create policy[\s\S]*?for insert[\s\S]*?bucket_id = 'tradein-photos'/i;
    expect(executableSql).not.toMatch(insertPolicyOnTradein);
  });

  it("bucket nasce com `public: false` (não false como string nem `true` por engano)", () => {
    // Sanity: garante que o INSERT do bucket `tradein-photos` use o
    // literal SQL `false` (não 'false' string). Caso bug futuro troque,
    // este test pega na hora.
    expect(executableSql).toMatch(
      /values \('tradein-photos', 'tradein-photos', false\)/i,
    );
  });
});

// ===========================================================================
// SQL — outras anti-padrões intencionalmente ausentes
// ===========================================================================

describe("migration 0019 — intentional absences", () => {
  it("NÃO define NOT NULL na coluna visual_identity (legacy sites nascem NULL)", () => {
    expect(executableSql).not.toMatch(
      /add column if not exists visual_identity jsonb[^;]*not null/i,
    );
  });

  it("NÃO faz UPDATE de backfill em rows legadas (admin gera sob demanda)", () => {
    expect(executableSql).not.toMatch(
      /update public\.lead_sites[\s\S]*?set\s+visual_identity/i,
    );
  });

  it("rollback documentado no header (DROP COLUMN + DELETE buckets)", () => {
    expect(sql).toMatch(/Rollback/i);
    expect(sql).toMatch(
      /alter table public\.lead_sites drop column if exists visual_identity/i,
    );
    expect(sql).toMatch(
      /delete from storage\.buckets where id in \('visual-identity','tradein-photos'\)/i,
    );
  });
});
