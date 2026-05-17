import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://app.test" },
}));

import sitemap from "@/app/sites/sitemap";
import { createServiceSupabase } from "@/lib/supabase/service";

const makeSupabaseMock = (rows: Array<{ slug: string; updated_at: string }>) => ({
  from: () => ({
    select: () => ({
      in: () => ({
        not: () => ({
          order: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  }),
});

describe("sitemap (global sites)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists all published+sent sites with signed_at not null", async () => {
    vi.mocked(createServiceSupabase).mockReturnValue(
      makeSupabaseMock([
        { slug: "poliguara", updated_at: "2026-05-10T10:00:00Z" },
        { slug: "stilos", updated_at: "2026-05-12T08:00:00Z" },
      ]) as never,
    );
    const result = await sitemap();
    expect(result).toHaveLength(2);
    expect(result[0]!).toMatchObject({
      url: "https://app.test/sites/poliguara",
      changeFrequency: "weekly",
      priority: 0.8,
    });
    expect(result[0]!.lastModified).toBeInstanceOf(Date);
  });

  it("returns empty array when query errors", async () => {
    vi.mocked(createServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () => ({
            not: () => ({
              order: () => Promise.resolve({ data: null, error: { message: "boom" } }),
            }),
          }),
        }),
      }),
    } as never);
    const result = await sitemap();
    expect(result).toEqual([]);
  });

  it("returns empty array when no sites match", async () => {
    vi.mocked(createServiceSupabase).mockReturnValue(makeSupabaseMock([]) as never);
    const result = await sitemap();
    expect(result).toEqual([]);
  });
});
