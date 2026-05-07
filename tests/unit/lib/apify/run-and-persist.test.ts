import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APIFY_TOKEN: "t",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "compass~crawler-google-places",
  APIFY_INSTAGRAM_ACTOR_ID: "apify~instagram-scraper",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "vdrmota~contact-info-scraper",
  ANTHROPIC_API_KEY: "k",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
} as const;

let savedEnv: NodeJS.ProcessEnv;

const apifyMock = vi.hoisted(() => ({
  actor: vi.fn(),
  dataset: vi.fn(),
  call: vi.fn(),
  listItems: vi.fn(),
}));

vi.mock("apify-client", () => {
  class ApifyClient {
    actor(id: string) {
      apifyMock.actor(id);
      return { call: apifyMock.call };
    }
    dataset(id: string) {
      apifyMock.dataset(id);
      return { listItems: apifyMock.listItems };
    }
  }
  return { ApifyClient };
});

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, VALID_ENV);
  apifyMock.actor.mockReset();
  apifyMock.dataset.mockReset();
  apifyMock.call.mockReset();
  apifyMock.listItems.mockReset();
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

interface FakeJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  results_count: number;
  error_message: string | null;
  finished_at: string | null;
}

function makeSupabaseMock(initialJob: Partial<FakeJob> = {}) {
  const job: FakeJob = {
    id: "job-1",
    status: "queued",
    results_count: 0,
    error_message: null,
    finished_at: null,
    ...initialJob,
  };

  const insertJob = vi.fn(() => ({
    select: () => ({
      single: () => Promise.resolve({ data: { ...job }, error: null }),
    }),
  }));

  const updateJob = vi.fn((patch: Partial<FakeJob>) => {
    Object.assign(job, patch);
    return {
      eq: () => Promise.resolve({ data: null, error: null }),
    };
  });

  const upsertLeads = vi.fn<
    (...args: unknown[]) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>
  >(() => Promise.resolve({ data: null, error: null }));

  const from = vi.fn((table: string) => {
    if (table === "search_jobs") {
      return { insert: insertJob, update: updateJob };
    }
    if (table === "leads") {
      return { upsert: upsertLeads };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as Parameters<
      typeof import("@/lib/apify/run-and-persist").runAndPersist
    >[0]["supabase"],
    insertJob,
    updateJob,
    upsertLeads,
    job,
  };
}

describe("runAndPersist", () => {
  it("cria search_job, dispara actor, mapeia items, upserta leads e marca succeeded", async () => {
    apifyMock.call.mockResolvedValue({ defaultDatasetId: "ds-1" });
    apifyMock.listItems.mockResolvedValue({
      items: [{ x: 1 }, { x: 2 }],
    });

    const { runAndPersist } = await import("@/lib/apify/run-and-persist");
    const supa = makeSupabaseMock();

    const result = await runAndPersist({
      supabase: supa.client,
      userId: "user-1",
      source: "google_maps",
      actorId: "compass~crawler-google-places",
      input: { searchStringsArray: ["barbearia"] },
      mapper: (item, ctx) => ({
        user_id: ctx.userId,
        source: ctx.source,
        source_search_job_id: ctx.jobId,
        name: `Item ${(item as { x: number }).x}`,
      }),
    });

    expect(supa.insertJob).toHaveBeenCalledTimes(1);
    expect(apifyMock.actor).toHaveBeenCalledWith(
      "compass~crawler-google-places",
    );
    expect(apifyMock.call).toHaveBeenCalled();
    expect(apifyMock.dataset).toHaveBeenCalledWith("ds-1");
    expect(supa.upsertLeads).toHaveBeenCalledTimes(1);
    expect(supa.updateJob).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "succeeded",
        results_count: 2,
      }),
    );
    expect(result.status).toBe("succeeded");
    expect(result.leadsCount).toBe(2);
  });

  it("marca job failed quando actor lança", async () => {
    apifyMock.call.mockRejectedValue(new Error("actor explodiu"));
    const { runAndPersist } = await import("@/lib/apify/run-and-persist");
    const supa = makeSupabaseMock();

    await expect(
      runAndPersist({
        supabase: supa.client,
        userId: "user-1",
        source: "google_maps",
        actorId: "x",
        input: {},
        mapper: () => ({
          user_id: "u",
          source: "google_maps",
          source_search_job_id: "j",
          name: "x",
        }),
      }),
    ).rejects.toThrow(/actor explodiu/);

    expect(supa.updateJob).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: expect.stringMatching(/actor explodiu/),
      }),
    );
  });

  it("dataset vazio resulta em job succeeded com 0 leads", async () => {
    apifyMock.call.mockResolvedValue({ defaultDatasetId: "ds-x" });
    apifyMock.listItems.mockResolvedValue({ items: [] });
    const { runAndPersist } = await import("@/lib/apify/run-and-persist");
    const supa = makeSupabaseMock();
    const result = await runAndPersist({
      supabase: supa.client,
      userId: "user-1",
      source: "instagram",
      actorId: "x",
      input: {},
      mapper: () => ({
        user_id: "u",
        source: "instagram",
        source_search_job_id: "j",
        name: "x",
      }),
    });
    expect(result.leadsCount).toBe(0);
    expect(supa.upsertLeads).not.toHaveBeenCalled();
    expect(supa.updateJob).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "succeeded", results_count: 0 }),
    );
  });

  it("mapper que retorna null filtra o item", async () => {
    apifyMock.call.mockResolvedValue({ defaultDatasetId: "ds-y" });
    apifyMock.listItems.mockResolvedValue({
      items: [{ x: 1 }, { x: 2 }, { x: 3 }],
    });
    const { runAndPersist } = await import("@/lib/apify/run-and-persist");
    const supa = makeSupabaseMock();
    const result = await runAndPersist({
      supabase: supa.client,
      userId: "u",
      source: "google_maps",
      actorId: "x",
      input: {},
      mapper: (item) => {
        const it = item as { x: number };
        return it.x === 2
          ? null
          : {
              user_id: "u",
              source: "google_maps",
              source_search_job_id: "j",
              name: `${it.x}`,
            };
      },
    });
    expect(result.leadsCount).toBe(2);
    const firstCall = supa.upsertLeads.mock.calls[0];
    expect(firstCall).toBeDefined();
    const upsertArgs = firstCall![0] as unknown[];
    expect(upsertArgs.length).toBe(2);
  });

  it("propaga erro do upsert e marca job failed", async () => {
    apifyMock.call.mockResolvedValue({ defaultDatasetId: "ds-1" });
    apifyMock.listItems.mockResolvedValue({ items: [{ x: 1 }] });
    const { runAndPersist } = await import("@/lib/apify/run-and-persist");
    const supa = makeSupabaseMock();
    supa.upsertLeads.mockResolvedValue({
      data: null,
      error: { message: "RLS deny" },
    });
    await expect(
      runAndPersist({
        supabase: supa.client,
        userId: "u",
        source: "google_maps",
        actorId: "x",
        input: {},
        mapper: () => ({
          user_id: "u",
          source: "google_maps",
          source_search_job_id: "j",
          name: "x",
        }),
      }),
    ).rejects.toThrow(/RLS deny/);
    expect(supa.updateJob).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
