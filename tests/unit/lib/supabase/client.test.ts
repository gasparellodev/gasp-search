import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PUBLIC_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
} as const;

let savedEnv: NodeJS.ProcessEnv;
const browserFactory = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: browserFactory,
}));

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, PUBLIC_ENV);
  browserFactory.mockReset();
  browserFactory.mockReturnValue({ marker: "browser-instance" });
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

describe("lib/supabase/client", () => {
  it("createBrowserSupabase passa URL e anon key públicas", async () => {
    const { createBrowserSupabase } = await import("@/lib/supabase/client");
    const client = createBrowserSupabase();
    expect(client).toEqual({ marker: "browser-instance" });
    expect(browserFactory).toHaveBeenCalledTimes(1);
    expect(browserFactory).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "anon-key-123",
    );
  });

  it("cada chamada cria nova instância (não cacheia)", async () => {
    const { createBrowserSupabase } = await import("@/lib/supabase/client");
    createBrowserSupabase();
    createBrowserSupabase();
    expect(browserFactory).toHaveBeenCalledTimes(2);
  });
});
