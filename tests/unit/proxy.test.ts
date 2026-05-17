import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(() => new Response(null, { status: 200 })),
}));

import { proxy } from "@/proxy";
import { updateSession } from "@/lib/supabase/middleware";

const makeReq = (url: string): NextRequest =>
  new NextRequest(new Request(url));

describe("proxy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects 308 to canonical form when /sites/* pathname is non-canonical", async () => {
    const req = makeReq("https://app.test/Sites/Poliguara/");
    const response = await proxy(req);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toContain("/sites/poliguara");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("preserves query string in canonical redirect", async () => {
    const req = makeReq("https://app.test/Sites/X/Estoque?categoria=sedan&pmin=80000");
    const response = await proxy(req);
    expect(response.status).toBe(308);
    const location = response.headers.get("location")!;
    expect(location).toContain("/sites/x/estoque");
    expect(location).toContain("categoria=sedan");
    expect(location).toContain("pmin=80000");
  });

  it("delegates to updateSession when /sites/* pathname already canonical", async () => {
    const req = makeReq("https://app.test/sites/poliguara/estoque");
    await proxy(req);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("delegates to updateSession for non-site paths", async () => {
    const req = makeReq("https://app.test/dashboard");
    await proxy(req);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("delegates to updateSession for root path", async () => {
    const req = makeReq("https://app.test/");
    await proxy(req);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });
});
