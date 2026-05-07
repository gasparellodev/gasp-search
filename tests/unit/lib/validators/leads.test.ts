import { describe, expect, it } from "vitest";
import {
  LEAD_PAGE_SIZE_OPTIONS,
  LEAD_SORTABLE_COLUMNS,
  parseLeadsListParams,
} from "@/lib/validators/leads";

describe("parseLeadsListParams", () => {
  it("retorna defaults quando nenhum parâmetro é passado", () => {
    const result = parseLeadsListParams({});

    expect(result).toEqual({
      page: 1,
      pageSize: 25,
      sortBy: "created_at",
      sortDir: "desc",
    });
  });

  it("aceita pageSize de 25, 50 e 100", () => {
    for (const size of LEAD_PAGE_SIZE_OPTIONS) {
      const result = parseLeadsListParams({ pageSize: String(size) });
      expect(result.pageSize).toBe(size);
    }
  });

  it("rejeita pageSize fora dos valores permitidos com fallback no default", () => {
    const result = parseLeadsListParams({ pageSize: "37" });
    expect(result.pageSize).toBe(25);
  });

  it("rejeita page menor que 1 com fallback em 1", () => {
    expect(parseLeadsListParams({ page: "0" }).page).toBe(1);
    expect(parseLeadsListParams({ page: "-3" }).page).toBe(1);
    expect(parseLeadsListParams({ page: "abc" }).page).toBe(1);
  });

  it("aceita page maior que 1", () => {
    expect(parseLeadsListParams({ page: "5" }).page).toBe(5);
  });

  it("aceita colunas sortable conhecidas", () => {
    for (const column of LEAD_SORTABLE_COLUMNS) {
      const result = parseLeadsListParams({ sortBy: column });
      expect(result.sortBy).toBe(column);
    }
  });

  it("rejeita sortBy desconhecido com fallback em created_at", () => {
    const result = parseLeadsListParams({ sortBy: "ssn" });
    expect(result.sortBy).toBe("created_at");
  });

  it("aceita sortDir asc/desc com fallback em desc", () => {
    expect(parseLeadsListParams({ sortDir: "asc" }).sortDir).toBe("asc");
    expect(parseLeadsListParams({ sortDir: "desc" }).sortDir).toBe("desc");
    expect(parseLeadsListParams({ sortDir: "weird" }).sortDir).toBe("desc");
  });

  it("aceita URLSearchParams como entrada", () => {
    const params = new URLSearchParams({
      page: "2",
      pageSize: "50",
      sortBy: "name",
      sortDir: "asc",
    });
    expect(parseLeadsListParams(params)).toEqual({
      page: 2,
      pageSize: 50,
      sortBy: "name",
      sortDir: "asc",
    });
  });
});
