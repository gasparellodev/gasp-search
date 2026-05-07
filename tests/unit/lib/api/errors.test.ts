import { describe, expect, it, vi } from "vitest";
import { apiErrorResponse } from "@/lib/api/errors";

describe("apiErrorResponse", () => {
  it("retorna erro amigável e registra log estruturado sem expor stack", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = apiErrorResponse(
      new Error("duplicate key value violates unique constraint"),
      { route: "POST /api/leads", userId: "user-1" },
      "Falha ao criar lead. Tente novamente.",
      502,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Falha ao criar lead. Tente novamente.",
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const log = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as {
      requestId: string;
      route: string;
      userId: string;
      message: string;
      stack?: string;
    };
    expect(log.requestId).toEqual(expect.any(String));
    expect(log.route).toBe("POST /api/leads");
    expect(log.userId).toBe("user-1");
    expect(log.message).toContain("duplicate key");
    expect(log.stack).toBeUndefined();

    consoleSpy.mockRestore();
  });
});
