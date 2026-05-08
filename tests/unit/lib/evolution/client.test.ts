import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    EVOLUTION_API_URL: "http://localhost:8080",
    EVOLUTION_API_KEY: "default-key",
  },
}));

const { createEvolutionClient, EvolutionApiError } = await import(
  "@/lib/evolution/client"
);

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function makeResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function makeEmptyResponse(status = 200): Response {
  return new Response("", { status });
}

const baseOpts = {
  baseUrl: "https://evo.test",
  apiKey: "test-api-key",
};

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe("createEvolutionClient", () => {
  it("lança EvolutionApiError quando apiKey está vazia", () => {
    expect(() =>
      createEvolutionClient({ baseUrl: baseOpts.baseUrl, apiKey: "" }),
    ).toThrow(EvolutionApiError);
  });

  it("createInstance envia POST com instanceName e normaliza status connected", async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      makeResponse({
        instance: { instanceName: "user-abc", status: "open" },
        qrcode: { base64: "data:image/png;base64,xxx" },
      }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });

    const result = await client.createInstance("user-abc");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://evo.test/instance/create");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.apikey).toBe("test-api-key");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({ instanceName: "user-abc", qrcode: true });
    expect(result).toEqual({
      instanceName: "user-abc",
      status: "connected",
      qrcode: "data:image/png;base64,xxx",
    });
  });

  it("createInstance mapeia status desconhecido para 'error'", async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      makeResponse({ instance: { instanceName: "x", status: "weird" } }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    const result = await client.createInstance("x");
    expect(result.status).toBe("error");
    expect(result.qrcode).toBeNull();
  });

  it("createInstance lança EvolutionApiError em 401", async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      makeResponse(
        { message: "unauthorized" },
        { status: 401, statusText: "Unauthorized" },
      ),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    await expect(client.createInstance("x")).rejects.toMatchObject({
      name: "EvolutionApiError",
      status: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("createInstance lança em 500 com message do server", async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      makeResponse({ message: "boom" }, { status: 500 }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    await expect(client.createInstance("x")).rejects.toMatchObject({
      status: 500,
      code: "HTTP_ERROR",
    });
  });

  it("createInstance lança SCHEMA_MISMATCH se resposta inesperada", async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      makeResponse({ unexpected: true }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    await expect(client.createInstance("x")).rejects.toMatchObject({
      code: "SCHEMA_MISMATCH",
    });
  });

  it("createInstance lança NETWORK_ERROR quando fetch falha", async () => {
    const fetchMock: FetchMock = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    await expect(client.createInstance("x")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });
  });

  it("createInstance lança INVALID_JSON em body texto não-JSON", async () => {
    const fetchMock: FetchMock = vi.fn(
      async () => new Response("<html>oops</html>", { status: 502 }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    await expect(client.createInstance("x")).rejects.toMatchObject({
      code: "INVALID_JSON",
    });
  });

  it("getQRCode retorna qrcode base64 e pairingCode", async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      makeResponse({ base64: "data:abc", pairingCode: "1234" }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    const qr = await client.getQRCode("user-abc");
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://evo.test/instance/connect/user-abc",
    );
    expect(qr).toEqual({ qrcode: "data:abc", pairingCode: "1234" });
  });

  it("sendText posta number+text e retorna messageId", async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      makeResponse({
        key: { id: "evo-msg-1", remoteJid: "55119@s.whatsapp.net" },
        status: "PENDING",
      }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    const sent = await client.sendText("user-abc", "5511999", "Olá!");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://evo.test/message/sendText/user-abc");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toEqual({ number: "5511999", text: "Olá!" });
    expect(sent).toEqual({ messageId: "evo-msg-1", status: "PENDING" });
  });

  it("sendText valida número de destino vazio sem chamar fetch", async () => {
    const fetchMock: FetchMock = vi.fn();
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    await expect(client.sendText("user-abc", "", "msg")).rejects.toMatchObject({
      code: "INVALID_PHONE",
      status: 422,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getStatus extrai phone do owner JID", async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      makeResponse({
        instance: {
          state: "open",
          owner: "5511999998888@s.whatsapp.net",
        },
      }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    const status = await client.getStatus("user-abc");
    expect(status).toEqual({
      status: "connected",
      phoneNumber: "5511999998888",
    });
  });

  it("getStatus retorna disconnected quando state ausente", async () => {
    const fetchMock: FetchMock = vi.fn(async () => makeResponse({}));
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    const status = await client.getStatus("user-abc");
    expect(status.status).toBe("disconnected");
    expect(status.phoneNumber).toBeNull();
  });

  it("deleteInstance manda DELETE e tolera body vazio", async () => {
    const fetchMock: FetchMock = vi.fn(async () => makeEmptyResponse(200));
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    await expect(client.deleteInstance("user-abc")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://evo.test/instance/delete/user-abc",
    );
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe("DELETE");
  });

  it("deleteInstance lança em 404", async () => {
    const fetchMock: FetchMock = vi.fn(
      async () => new Response("", { status: 404 }),
    );
    const client = createEvolutionClient({ ...baseOpts, fetch: fetchMock });
    await expect(client.deleteInstance("user-abc")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("buildUrl lida com baseUrl com / no final sem duplicar", async () => {
    const fetchMock: FetchMock = vi.fn(async () => makeResponse({}));
    const client = createEvolutionClient({
      baseUrl: "https://evo.test/",
      apiKey: "k",
      fetch: fetchMock,
    });
    await client.getStatus("u");
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://evo.test/instance/connectionState/u",
    );
  });
});
