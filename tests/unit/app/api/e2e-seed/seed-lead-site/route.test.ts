/**
 * Unit tests for `POST /api/e2e-seed/seed-lead-site` (Phase 7 #166).
 *
 * Cobertura mínima por AC1:
 *   - 404 quando NODE_ENV=production (gate de boot).
 *   - 401 quando token não bate.
 *   - 503 quando TEST_SEED_TOKEN/TEST_SEED_USER_ID ausentes.
 *   - 200 + insere lead + lead_sites no happy path.
 *   - DELETE happy path remove a row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validSiteVariablesFixture } from "@/tests/fixtures/site-variables";

const supabaseMocks = vi.hoisted(() => ({
  createServiceSupabase: vi.fn(),
  insertLeadSelect: vi.fn(),
  insertSite: vi.fn(),
  selectSiteMaybeSingle: vi.fn(),
  deleteSiteEq: vi.fn(),
  deleteLeadEq: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: supabaseMocks.createServiceSupabase,
}));

function buildSupabaseStub() {
  return {
    from(table: string) {
      if (table === "leads") {
        return {
          insert: () => ({
            select: () => ({
              single: supabaseMocks.insertLeadSelect,
            }),
          }),
          delete: () => ({ eq: supabaseMocks.deleteLeadEq }),
        };
      }
      if (table === "lead_sites") {
        return {
          insert: supabaseMocks.insertSite,
          select: () => ({
            eq: () => ({
              maybeSingle: supabaseMocks.selectSiteMaybeSingle,
            }),
          }),
          delete: () => ({ eq: supabaseMocks.deleteSiteEq }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.createServiceSupabase.mockReset();
  supabaseMocks.insertLeadSelect.mockReset();
  supabaseMocks.insertSite.mockReset();
  supabaseMocks.selectSiteMaybeSingle.mockReset();
  supabaseMocks.deleteSiteEq.mockReset();
  supabaseMocks.deleteLeadEq.mockReset();
  supabaseMocks.createServiceSupabase.mockReturnValue(buildSupabaseStub());

  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    TEST_SEED_TOKEN: "e2e-test-token-2026-1234",
    TEST_SEED_USER_ID: "11111111-1111-1111-1111-111111111111",
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL_ENV };
});

function postReq(token: string | null, body: unknown) {
  const url =
    "http://localhost:3000/api/e2e-seed/seed-lead-site" +
    (token === null ? "" : `?token=${encodeURIComponent(token)}`);
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq(token: string | null, slug: string | null) {
  const params = new URLSearchParams();
  if (token !== null) params.set("token", token);
  if (slug !== null) params.set("slug", slug);
  const url =
    "http://localhost:3000/api/e2e-seed/seed-lead-site?" + params.toString();
  return new Request(url, { method: "DELETE" });
}

describe("POST /api/e2e-seed/seed-lead-site", () => {
  it("retorna 404 quando NODE_ENV=production (gate primário)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await POST(
      postReq("e2e-test-token-2026-1234", {
        slug: "test-slug",
        status: "published",
        variables: validSiteVariablesFixture,
      }),
    );
    expect(res.status).toBe(404);
    expect(supabaseMocks.createServiceSupabase).not.toHaveBeenCalled();
  });

  it("retorna 503 quando TEST_SEED_TOKEN ausente (gate de configuração)", async () => {
    delete process.env.TEST_SEED_TOKEN;
    const { POST } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await POST(
      postReq("any-token", {
        slug: "test-slug",
        status: "published",
        variables: validSiteVariablesFixture,
      }),
    );
    expect(res.status).toBe(503);
    expect(supabaseMocks.createServiceSupabase).not.toHaveBeenCalled();
  });

  it("retorna 401 quando token não bate", async () => {
    const { POST } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await POST(
      postReq("wrong-token", {
        slug: "test-slug",
        status: "published",
        variables: validSiteVariablesFixture,
      }),
    );
    expect(res.status).toBe(401);
    expect(supabaseMocks.createServiceSupabase).not.toHaveBeenCalled();
  });

  it("retorna 503 quando TEST_SEED_USER_ID ausente", async () => {
    delete process.env.TEST_SEED_USER_ID;
    const { POST } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await POST(
      postReq("e2e-test-token-2026-1234", {
        slug: "test-slug",
        status: "published",
        variables: validSiteVariablesFixture,
      }),
    );
    expect(res.status).toBe(503);
  });

  it("retorna 400 com slug inválido", async () => {
    const { POST } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await POST(
      postReq("e2e-test-token-2026-1234", {
        slug: "##bad slug##",
        status: "published",
        variables: validSiteVariablesFixture,
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_slug" });
  });

  it("retorna 400 com status inválido", async () => {
    const { POST } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await POST(
      postReq("e2e-test-token-2026-1234", {
        slug: "test-slug",
        status: "weird",
        variables: validSiteVariablesFixture,
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_status" });
  });

  it("happy path: insere lead + lead_sites e retorna 200", async () => {
    supabaseMocks.insertLeadSelect.mockResolvedValue({
      data: { id: "lead-uuid-1" },
      error: null,
    });
    supabaseMocks.insertSite.mockResolvedValue({ error: null });

    const { POST } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await POST(
      postReq("e2e-test-token-2026-1234", {
        slug: "valid-slug-abc",
        status: "published",
        variables: validSiteVariablesFixture,
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      slug: "valid-slug-abc",
      leadId: "lead-uuid-1",
    });
    expect(supabaseMocks.insertLeadSelect).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.insertSite).toHaveBeenCalledTimes(1);
  });

  it("rollback: se site insert falhar, lead órfão é deletado", async () => {
    supabaseMocks.insertLeadSelect.mockResolvedValue({
      data: { id: "lead-uuid-2" },
      error: null,
    });
    supabaseMocks.insertSite.mockResolvedValue({
      error: { message: "duplicate slug" },
    });
    supabaseMocks.deleteLeadEq.mockResolvedValue({ error: null });

    const { POST } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await POST(
      postReq("e2e-test-token-2026-1234", {
        slug: "valid-slug-xyz",
        status: "published",
        variables: validSiteVariablesFixture,
      }),
    );
    expect(res.status).toBe(500);
    expect(supabaseMocks.deleteLeadEq).toHaveBeenCalledWith(
      "id",
      "lead-uuid-2",
    );
  });
});

describe("DELETE /api/e2e-seed/seed-lead-site", () => {
  it("retorna 404 em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { DELETE } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await DELETE(
      deleteReq("e2e-test-token-2026-1234", "any-slug"),
    );
    expect(res.status).toBe(404);
  });

  it("retorna 401 com token inválido", async () => {
    const { DELETE } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await DELETE(deleteReq("wrong", "any-slug"));
    expect(res.status).toBe(401);
  });

  it("retorna 400 sem slug", async () => {
    const { DELETE } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await DELETE(deleteReq("e2e-test-token-2026-1234", null));
    expect(res.status).toBe(400);
  });

  it("happy path: deleta lead_sites + lead pai", async () => {
    supabaseMocks.selectSiteMaybeSingle.mockResolvedValue({
      data: { lead_id: "lead-1" },
      error: null,
    });
    supabaseMocks.deleteSiteEq.mockResolvedValue({ error: null });
    supabaseMocks.deleteLeadEq.mockResolvedValue({ error: null });

    const { DELETE } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await DELETE(
      deleteReq("e2e-test-token-2026-1234", "test-slug"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      slug: "test-slug",
      deleted: true,
    });
    expect(supabaseMocks.deleteLeadEq).toHaveBeenCalledWith("id", "lead-1");
  });

  it("retorna deleted=false quando slug não existe", async () => {
    supabaseMocks.selectSiteMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { DELETE } = await import("@/app/api/e2e-seed/seed-lead-site/route");
    const res = await DELETE(
      deleteReq("e2e-test-token-2026-1234", "ghost-slug"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ deleted: false });
    expect(supabaseMocks.deleteSiteEq).not.toHaveBeenCalled();
  });
});
