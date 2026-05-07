import { describe, expect, it } from "vitest";
import {
  mapInstagramProfile,
  normalizeInstagramHandle,
  type InstagramProfile,
} from "@/lib/apify/instagram";
import profiles from "../../../fixtures/instagram/profiles.json";

const ctx = {
  userId: "user-1",
  jobId: "job-ig",
  source: "instagram",
} as const;

describe("normalizeInstagramHandle", () => {
  it("remove arroba e baixa caixa", () => {
    expect(normalizeInstagramHandle("@Barbearia_X")).toBe("barbearia_x");
  });

  it("trim e fallback null em vazio", () => {
    expect(normalizeInstagramHandle("   @abc  ")).toBe("abc");
    expect(normalizeInstagramHandle("")).toBeNull();
    expect(normalizeInstagramHandle(null)).toBeNull();
    expect(normalizeInstagramHandle(undefined)).toBeNull();
  });

  it("remove caracteres inválidos do handle (mantém letra/número/. _)", () => {
    expect(normalizeInstagramHandle("@dr. pedro")).toBe("dr.pedro");
    expect(normalizeInstagramHandle("Estética.Maria")).toBe("estética.maria");
  });
});

describe("mapInstagramProfile", () => {
  it("mapeia username, fullName→name, biography→notes, followersCount, externalUrl→website", () => {
    const profile = (profiles as InstagramProfile[])[0]!;
    const lead = mapInstagramProfile(profile, ctx);

    expect(lead).not.toBeNull();
    expect(lead!.user_id).toBe("user-1");
    expect(lead!.source).toBe("instagram");
    expect(lead!.source_search_job_id).toBe("job-ig");
    expect(lead!.name).toBe("Barbearia Bigode");
    expect(lead!.instagram_handle).toBe("barbearia_bigode");
    expect(lead!.notes).toContain("Barbearia tradicional");
    expect(lead!.followers_count).toBe(5230);
    expect(lead!.website).toBe("bigode.com.br");
    expect(lead!.has_website).toBe(true);
    expect(lead!.category).toBe("Barbearia");
  });

  it("normaliza handle com @ e maiúsculas (estética.maria)", () => {
    const profile = (profiles as InstagramProfile[])[1]!;
    const lead = mapInstagramProfile(profile, ctx);
    expect(lead).not.toBeNull();
    expect(lead!.instagram_handle).toBe("estética.maria");
    expect(lead!.website).toBe("esteticamaria.com.br");
    expect(lead!.has_website).toBe(true);
  });

  it("biography vazia vira notes null, externalUrl ausente vira website null + has_website false", () => {
    const profile = (profiles as InstagramProfile[])[2]!;
    const lead = mapInstagramProfile(profile, ctx);
    expect(lead).not.toBeNull();
    expect(lead!.notes).toBeNull();
    expect(lead!.website).toBeNull();
    expect(lead!.has_website).toBe(false);
  });

  it("externalUrl null fica null", () => {
    const profile = (profiles as InstagramProfile[])[3]!;
    const lead = mapInstagramProfile(profile, ctx);
    expect(lead).not.toBeNull();
    expect(lead!.website).toBeNull();
    expect(lead!.has_website).toBe(false);
  });

  it("retorna null quando username está vazio (skip)", () => {
    const profile = (profiles as InstagramProfile[])[4]!;
    const lead = mapInstagramProfile(profile, ctx);
    expect(lead).toBeNull();
  });

  it("aceita 5 perfis e produz 4 leads (último é skip)", () => {
    const items = profiles as InstagramProfile[];
    const leads = items
      .map((profile) => mapInstagramProfile(profile, ctx))
      .filter((lead) => lead !== null);
    expect(leads).toHaveLength(4);
    const handles = leads.map((lead) => lead!.instagram_handle);
    expect(handles).toEqual([
      "barbearia_bigode",
      "estética.maria",
      "loja_x_oficial",
      "consultorio.dr.pedro",
    ]);
  });

  it("name fallback usa username quando fullName ausente", () => {
    const lead = mapInstagramProfile(
      { username: "loja_y", followersCount: 10 } as InstagramProfile,
      ctx,
    );
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("loja_y");
  });
});
