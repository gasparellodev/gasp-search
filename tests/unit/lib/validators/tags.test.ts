import { describe, expect, it } from "vitest";
import { createTagSchema, updateTagSchema } from "@/lib/validators/tags";

describe("createTagSchema", () => {
  it("aceita name e color hex válidos", () => {
    const result = createTagSchema.safeParse({
      name: "Quente",
      color: "#ef4444",
    });
    expect(result.success).toBe(true);
  });

  it("usa cor default quando omitida", () => {
    const result = createTagSchema.safeParse({ name: "Frio" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("rejeita name muito curto ou muito longo", () => {
    expect(createTagSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createTagSchema.safeParse({ name: "X" }).success).toBe(false);
    expect(
      createTagSchema.safeParse({ name: "a".repeat(41) }).success,
    ).toBe(false);
  });

  it("rejeita color em formato inválido", () => {
    expect(
      createTagSchema.safeParse({ name: "X", color: "vermelho" }).success,
    ).toBe(false);
    expect(
      createTagSchema.safeParse({ name: "X", color: "#fff" }).success,
    ).toBe(false);
    expect(
      createTagSchema.safeParse({ name: "X", color: "#GGGGGG" }).success,
    ).toBe(false);
  });

  it("trim no name", () => {
    const result = createTagSchema.safeParse({ name: "  Quente  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Quente");
  });
});

describe("updateTagSchema", () => {
  it("aceita body parcial (apenas name)", () => {
    expect(updateTagSchema.safeParse({ name: "Novo" }).success).toBe(true);
  });

  it("aceita body parcial (apenas color)", () => {
    expect(updateTagSchema.safeParse({ color: "#000000" }).success).toBe(true);
  });

  it("rejeita body vazio", () => {
    expect(updateTagSchema.safeParse({}).success).toBe(false);
  });
});
