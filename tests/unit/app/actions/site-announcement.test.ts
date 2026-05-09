import { describe, expect, it } from "vitest";

import { submitAnnouncement } from "@/app/actions/site-announcement";

const SITE_ID = "66666666-6666-4666-8666-666666666666";

const validPayload = {
  marca: "Toyota",
  modelo: "Corolla XEi",
  ano: 2022,
  km: 35000,
  preco: 119900,
  nome: "Maria Silva",
  telefone: "(11) 98765-4321",
  email: "maria@example.com",
  mensagem: "Carro impecável, único dono.",
  lgpd_consent: true as const,
};

describe("submitAnnouncement()", () => {
  it("retorna { ok: true } com payload válido", async () => {
    const r = await submitAnnouncement(SITE_ID, validPayload);
    expect(r).toEqual({ ok: true });
  });

  it("retorna { ok: true } quando preco é null (campo opcional)", async () => {
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      preco: null,
    });
    expect(r.ok).toBe(true);
  });

  it("retorna erro quando siteId vazio", async () => {
    const r = await submitAnnouncement("", validPayload);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/siteId/i);
    }
  });

  it("retorna erro quando email malformado", async () => {
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      email: "naoeumemail",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.toLowerCase()).toMatch(/mail|inválido/);
    }
  });

  it("retorna erro quando lgpd_consent=false", async () => {
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      lgpd_consent: false as unknown as true,
    });
    expect(r.ok).toBe(false);
  });

  it("retorna erro quando ano abaixo do mínimo (1980)", async () => {
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      ano: 1979,
    });
    expect(r.ok).toBe(false);
  });

  it("retorna erro quando ano acima do máximo (currentYear+1)", async () => {
    const tooFuture = new Date().getFullYear() + 5;
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      ano: tooFuture,
    });
    expect(r.ok).toBe(false);
  });

  it("retorna erro quando km negativo", async () => {
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      km: -1,
    });
    expect(r.ok).toBe(false);
  });

  it("retorna erro quando telefone tem menos de 10 dígitos", async () => {
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      telefone: "123456",
    });
    expect(r.ok).toBe(false);
  });

  it("retorna erro quando marca vazia (após trim)", async () => {
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      marca: "   ",
    });
    expect(r.ok).toBe(false);
  });
});
