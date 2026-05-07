import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrichLeadsByUrls,
  mapWebsiteContact,
  type WebsiteContactItem,
} from "@/lib/apify/enrich";
import items from "../../../fixtures/website-contact/items.json";

const apifyMock = vi.hoisted(() => ({
  call: vi.fn(),
  listItems: vi.fn(),
}));

vi.mock("apify-client", () => {
  class ApifyClient {
    actor() {
      return { call: apifyMock.call };
    }
    dataset() {
      return { listItems: apifyMock.listItems };
    }
  }
  return { ApifyClient };
});

vi.mock("@/lib/env", () => ({
  env: {
    APIFY_TOKEN: "t",
    APIFY_WEBSITE_CONTACT_ACTOR_ID: "vdrmota~contact-info-scraper",
  },
}));

describe("mapWebsiteContact", () => {
  it("normaliza URL e seleciona primeiro email/phone/whatsapp", () => {
    const item = (items as WebsiteContactItem[])[0]!;
    const result = mapWebsiteContact(item);
    expect(result.url).toBe("bigode.com.br");
    expect(result.email).toBe("contato@bigode.com.br");
    expect(result.phone).toBe("+55 41 99999-1234");
    // sem whatsapp explícito → null
    expect(result.whatsapp).toBeNull();
  });

  it("preenche whatsapp quando presente em campo dedicado", () => {
    const item = (items as WebsiteContactItem[])[1]!;
    const result = mapWebsiteContact(item);
    expect(result.url).toBe("esteticamaria.com.br");
    expect(result.email).toBe("maria@esteticamaria.com.br");
    expect(result.whatsapp).toBe("+55 11 91234-5678");
  });

  it("retorna nulls quando arrays vazios — sinaliza nada para atualizar", () => {
    const item = (items as WebsiteContactItem[])[2]!;
    const result = mapWebsiteContact(item);
    expect(result.url).toBe("semsite.com");
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.whatsapp).toBeNull();
  });
});

describe("enrichLeadsByUrls", () => {
  type ChainResult = {
    data: unknown;
    count: number | null;
    error: { message: string } | null;
  };

  function createSupabase(opts: {
    leads: Array<{ id: string; website: string }>;
    updateResult?: ChainResult;
  }) {
    const inFn = vi.fn(async () => ({
      data: opts.leads,
      error: null,
    }));
    const eqSelectChain = { in: inFn };
    const select = vi.fn(() => eqSelectChain);

    const eqUpdateChain = vi.fn(
      async () => opts.updateResult ?? { data: null, count: 1, error: null },
    );
    const update = vi.fn(() => ({
      eq: eqUpdateChain,
    }));

    const from = vi.fn(() => ({ select, update }));

    return {
      client: { from } as unknown as Parameters<
        typeof enrichLeadsByUrls
      >[0]["supabase"],
      spies: { from, select, inFn, update, eqUpdateChain },
    };
  }

  beforeEach(() => {
    apifyMock.call.mockReset();
    apifyMock.listItems.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chama actor com URLs e atualiza cada lead match com email/phone/whatsapp", async () => {
    apifyMock.call.mockResolvedValue({ defaultDatasetId: "ds-1" });
    apifyMock.listItems.mockResolvedValue({
      items: items as WebsiteContactItem[],
    });

    const supa = createSupabase({
      leads: [
        { id: "lead-1", website: "bigode.com.br" },
        { id: "lead-2", website: "esteticamaria.com.br" },
        { id: "lead-3", website: "semsite.com" },
      ],
    });

    const result = await enrichLeadsByUrls({
      supabase: supa.client,
      userId: "user-1",
      urls: [
        "https://www.bigode.com.br/",
        "esteticamaria.com.br",
        "semsite.com",
      ],
    });

    expect(apifyMock.call).toHaveBeenCalledTimes(1);
    const callArg = apifyMock.call.mock.calls[0]?.[0] as
      | { startUrls?: Array<{ url: string }> }
      | undefined;
    expect(callArg?.startUrls).toBeDefined();

    // Lead 1 e lead 2 devem ter sido atualizados; lead 3 não tem dados a atualizar
    expect(supa.spies.update).toHaveBeenCalledTimes(2);
    const updates = supa.spies.update.mock.calls.map(
      (call) => (call as unknown as [Record<string, unknown>])[0],
    );
    expect(updates[0]).toMatchObject({
      email: "contato@bigode.com.br",
      phone: "+55 41 99999-1234",
    });
    expect(updates[0]?.enriched_at).toBeDefined();
    expect(updates[1]).toMatchObject({
      email: "maria@esteticamaria.com.br",
      whatsapp: "+55 11 91234-5678",
    });

    expect(result.enrichedCount).toBe(2);
    expect(result.skippedUrls).toContain("semsite.com");
  });

  it("retorno vazio do actor não quebra e não atualiza nada", async () => {
    apifyMock.call.mockResolvedValue({ defaultDatasetId: "ds-1" });
    apifyMock.listItems.mockResolvedValue({ items: [] });

    const supa = createSupabase({
      leads: [{ id: "lead-1", website: "bigode.com.br" }],
    });

    const result = await enrichLeadsByUrls({
      supabase: supa.client,
      userId: "user-1",
      urls: ["bigode.com.br"],
    });

    expect(supa.spies.update).not.toHaveBeenCalled();
    expect(result.enrichedCount).toBe(0);
    expect(result.skippedUrls).toEqual(["bigode.com.br"]);
  });

  it("URL sem lead correspondente é skipped (não cria lead novo)", async () => {
    apifyMock.call.mockResolvedValue({ defaultDatasetId: "ds-1" });
    apifyMock.listItems.mockResolvedValue({
      items: [(items as WebsiteContactItem[])[0]!],
    });

    const supa = createSupabase({
      leads: [], // user não tem lead com esse website
    });

    const result = await enrichLeadsByUrls({
      supabase: supa.client,
      userId: "user-1",
      urls: ["bigode.com.br"],
    });

    expect(supa.spies.update).not.toHaveBeenCalled();
    expect(result.enrichedCount).toBe(0);
    expect(result.skippedUrls).toContain("bigode.com.br");
  });

  it("urls vazio: short-circuit — não chama Apify nem Supabase", async () => {
    const supa = createSupabase({ leads: [] });
    const result = await enrichLeadsByUrls({
      supabase: supa.client,
      userId: "user-1",
      urls: [],
    });
    expect(apifyMock.call).not.toHaveBeenCalled();
    expect(result.enrichedCount).toBe(0);
  });

  it("falha do actor lança erro tipado", async () => {
    apifyMock.call.mockRejectedValue(new Error("boom"));

    const supa = createSupabase({ leads: [] });
    await expect(
      enrichLeadsByUrls({
        supabase: supa.client,
        userId: "user-1",
        urls: ["bigode.com.br"],
      }),
    ).rejects.toThrow(/Falha ao executar enrich/);
  });
});
