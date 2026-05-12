import { describe, expect, it } from "vitest";
import {
  createLeadSchema,
  parseLeadsListInput,
  updateLeadSchema,
} from "@/lib/validators/leads";

describe("parseLeadsListInput", () => {
  it("retorna defaults com filtros vazios", () => {
    const result = parseLeadsListInput({});
    expect(result.params).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: "created_at",
      sortDir: "desc",
    });
    expect(result.filters).toEqual({
      q: undefined,
      stage: undefined,
      source: undefined,
      hasWebsite: undefined,
      tagIds: undefined,
    });
  });

  it("aceita filtros válidos", () => {
    const result = parseLeadsListInput({
      q: "barbearia",
      stage: "new",
      source: "google_maps",
      hasWebsite: "true",
      tagId: ["a", "b"],
    });
    expect(result.filters).toEqual({
      q: "barbearia",
      stage: "new",
      source: "google_maps",
      hasWebsite: true,
      tagIds: ["a", "b"],
    });
  });

  it("aceita tagId como string com vírgula", () => {
    const result = parseLeadsListInput({ tagId: "a,b,c" });
    expect(result.filters.tagIds).toEqual(["a", "b", "c"]);
  });

  it("ignora valores inválidos para stage e source", () => {
    const result = parseLeadsListInput({
      stage: "invalid",
      source: "wrong",
    });
    expect(result.filters.stage).toBeUndefined();
    expect(result.filters.source).toBeUndefined();
  });

  it("aceita hasWebsite false", () => {
    const result = parseLeadsListInput({ hasWebsite: "false" });
    expect(result.filters.hasWebsite).toBe(false);
  });

  it("trim e min length em q", () => {
    const result = parseLeadsListInput({ q: "  barbearia  " });
    expect(result.filters.q).toBe("barbearia");

    const empty = parseLeadsListInput({ q: " " });
    expect(empty.filters.q).toBeUndefined();
  });
});

describe("createLeadSchema", () => {
  it("exige name e source", () => {
    const ok = createLeadSchema.safeParse({
      name: "Barbearia X",
      source: "google_maps",
    });
    expect(ok.success).toBe(true);

    const noName = createLeadSchema.safeParse({ source: "google_maps" });
    expect(noName.success).toBe(false);

    const noSource = createLeadSchema.safeParse({ name: "X" });
    expect(noSource.success).toBe(false);
  });

  it("aceita campos opcionais", () => {
    const result = createLeadSchema.safeParse({
      name: "Barbearia X",
      source: "google_maps",
      category: "Barbearia",
      city: "Curitiba",
      state: "PR",
      phone: "+5541999999999",
      email: "x@x.com",
      website: "https://x.com",
      notes: "lead frio",
      score: 12,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita score fora de 0..100", () => {
    expect(
      createLeadSchema.safeParse({
        name: "X",
        source: "google_maps",
        score: 101,
      }).success,
    ).toBe(false);
    expect(
      createLeadSchema.safeParse({
        name: "X",
        source: "google_maps",
        score: -1,
      }).success,
    ).toBe(false);
  });
});

describe("updateLeadSchema", () => {
  it("aceita body parcial", () => {
    const result = updateLeadSchema.safeParse({ stage: "contacted" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ stage: "contacted" });
  });

  it("aceita tags como array de UUIDs", () => {
    const result = updateLeadSchema.safeParse({
      tagIds: [
        "9b6e1fcd-3b5d-4d6e-9b9d-1234567890ab",
        "c1a8e1f2-7f6a-4e10-b8d6-fedcba987654",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita body vazio", () => {
    const result = updateLeadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejeita stage inválido", () => {
    const result = updateLeadSchema.safeParse({ stage: "weird" });
    expect(result.success).toBe(false);
  });

  it("score precisa estar entre 0 e 100", () => {
    expect(updateLeadSchema.safeParse({ score: 50 }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ score: 200 }).success).toBe(false);
  });
});

// SSRF guard em `website` — bloqueia hosts privados/reservados e schemes
// não-http(s) (issue #138). Defense-in-depth contra exfiltração de
// metadata endpoints internos (AWS 169.254.169.254, link-local) e
// invocação de schemes perigosos (javascript:, data:, file:).
describe("createLeadSchema — website SSRF guard", () => {
  const base = { name: "Lead X", source: "google_maps" as const };

  function expectWebsite(value: string, ok: boolean): void {
    const result = createLeadSchema.safeParse({ ...base, website: value });
    expect(result.success).toBe(ok);
  }

  it("aceita https://example.com", () => {
    expectWebsite("https://example.com", true);
  });

  it("aceita http://example.com", () => {
    expectWebsite("http://example.com", true);
  });

  it("aceita null/undefined/'' (campo opcional)", () => {
    expect(createLeadSchema.safeParse({ ...base }).success).toBe(true);
    expect(
      createLeadSchema.safeParse({ ...base, website: null }).success,
    ).toBe(true);
    expect(
      createLeadSchema.safeParse({ ...base, website: "" }).success,
    ).toBe(true);
  });

  it("rejeita http://10.0.0.1 (RFC1918 privado)", () => {
    expectWebsite("http://10.0.0.1", false);
  });

  it("rejeita http://localhost", () => {
    expectWebsite("http://localhost", false);
  });

  it("rejeita http://127.0.0.1 (loopback IPv4)", () => {
    expectWebsite("http://127.0.0.1", false);
  });

  it("rejeita http://[::1] (loopback IPv6)", () => {
    expectWebsite("http://[::1]", false);
  });

  it("rejeita http://169.254.169.254 (AWS metadata / link-local)", () => {
    expectWebsite("http://169.254.169.254", false);
  });

  it("rejeita http://192.168.1.1 (RFC1918)", () => {
    expectWebsite("http://192.168.1.1", false);
  });

  it("rejeita http://172.16.0.1 (RFC1918 172.16/12)", () => {
    expectWebsite("http://172.16.0.1", false);
  });

  it("rejeita http://172.31.255.255 (limite superior 172.16/12)", () => {
    expectWebsite("http://172.31.255.255", false);
  });

  it("aceita http://172.32.0.1 (fora do range RFC1918 172.16/12)", () => {
    expectWebsite("http://172.32.0.1", true);
  });

  it("rejeita ftp://example.com (apenas http/s permitido)", () => {
    expectWebsite("ftp://example.com", false);
  });

  it("rejeita javascript:alert(1)", () => {
    expectWebsite("javascript:alert(1)", false);
  });

  it("rejeita data:text/html,<script>", () => {
    expectWebsite("data:text/html,<script>", false);
  });

  it("rejeita string que não é URL", () => {
    expectWebsite("not a url", false);
  });

  it("rejeita 0.0.0.0 (any-host reservado)", () => {
    expectWebsite("http://0.0.0.0", false);
  });

  it("rejeita CGNAT 100.64.0.0/10", () => {
    expectWebsite("http://100.64.0.1", false);
  });
});

describe("updateLeadSchema — website SSRF guard", () => {
  it("rejeita updateLead com website apontando para host privado", () => {
    const result = updateLeadSchema.safeParse({
      website: "http://127.0.0.1",
    });
    expect(result.success).toBe(false);
  });

  it("aceita updateLead com website público válido", () => {
    const result = updateLeadSchema.safeParse({
      website: "https://acme.com",
    });
    expect(result.success).toBe(true);
  });
});
