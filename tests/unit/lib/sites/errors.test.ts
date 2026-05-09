import { describe, expect, it } from "vitest";

import {
  GenerationError,
  LeadNotFoundError,
  RateLimitError,
  SiteVariablesValidationError,
  SlugCollisionError,
} from "@/lib/sites/errors";

describe("SlugCollisionError (existing)", () => {
  it("instancia com attempts e business_name", () => {
    const e = new SlugCollisionError(5, "Toyota do Recife");
    expect(e.name).toBe("SlugCollisionError");
    expect(e.attempts).toBe(5);
    expect(e.business_name).toBe("Toyota do Recife");
    expect(e.message).toMatch(/Toyota do Recife/);
    expect(e.message).toMatch(/5 attempts/);
  });

  it("é uma instance de Error", () => {
    expect(new SlugCollisionError(5, "X")).toBeInstanceOf(Error);
  });
});

describe("GenerationError (existing)", () => {
  it("instancia com code, retryable, message e cause opcional", () => {
    const cause = new Error("inner");
    const e = new GenerationError("api_error", true, "boom", cause);
    expect(e.name).toBe("GenerationError");
    expect(e.code).toBe("api_error");
    expect(e.retryable).toBe(true);
    expect(e.message).toBe("boom");
    expect(e.cause).toBe(cause);
  });

  it("aceita ausência de cause", () => {
    const e = new GenerationError("max_tokens", false, "trunc");
    expect(e.cause).toBeUndefined();
  });
});

describe("LeadNotFoundError (#159)", () => {
  it("carrega leadId no payload do erro", () => {
    const e = new LeadNotFoundError("lead-123");
    expect(e.name).toBe("LeadNotFoundError");
    expect(e.leadId).toBe("lead-123");
    expect(e.message).toMatch(/lead-123/);
  });

  it("é uma instance de Error (catch tipado funciona)", () => {
    expect(new LeadNotFoundError("x")).toBeInstanceOf(Error);
  });
});

describe("RateLimitError (#159)", () => {
  it("carrega retryAfterSec no payload do erro", () => {
    const e = new RateLimitError(45);
    expect(e.name).toBe("RateLimitError");
    expect(e.retryAfterSec).toBe(45);
    expect(e.message).toMatch(/45/);
  });

  it("é uma instance de Error", () => {
    expect(new RateLimitError(60)).toBeInstanceOf(Error);
  });
});

describe("SiteVariablesValidationError (#159)", () => {
  it("carrega cause original (Zod issues / etc) sem expor PII na message", () => {
    const cause = { issues: [{ path: ["primary_color"], message: "invalid" }] };
    const e = new SiteVariablesValidationError(cause);
    expect(e.name).toBe("SiteVariablesValidationError");
    expect(e.cause).toBe(cause);
    expect(e.message).toMatch(/schema validation/i);
  });

  it("é uma instance de Error", () => {
    expect(new SiteVariablesValidationError(null)).toBeInstanceOf(Error);
  });
});
