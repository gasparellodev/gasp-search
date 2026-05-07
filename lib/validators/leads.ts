import { z } from "zod";

export const LEAD_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type LeadPageSize = (typeof LEAD_PAGE_SIZE_OPTIONS)[number];

export const LEAD_SORTABLE_COLUMNS = [
  "name",
  "category",
  "city",
  "stage",
  "score",
  "created_at",
] as const;
export type LeadSortableColumn = (typeof LEAD_SORTABLE_COLUMNS)[number];

const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .catch(1)
  .default(1);

const pageSizeSchema = z.coerce
  .number()
  .int()
  .refine(
    (value): value is LeadPageSize =>
      (LEAD_PAGE_SIZE_OPTIONS as readonly number[]).includes(value),
    "pageSize precisa ser 25, 50 ou 100",
  )
  .catch(25)
  .default(25);

const sortBySchema = z
  .enum(LEAD_SORTABLE_COLUMNS)
  .catch("created_at")
  .default("created_at");

const sortDirSchema = z
  .enum(["asc", "desc"])
  .catch("desc")
  .default("desc");

export const leadsListParamsSchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    sortBy: sortBySchema,
    sortDir: sortDirSchema,
  })
  .strict();

export type LeadsListParams = {
  page: number;
  pageSize: LeadPageSize;
  sortBy: LeadSortableColumn;
  sortDir: "asc" | "desc";
};

type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function toRecord(input: RawParams): Record<string, string | undefined> {
  if (input instanceof URLSearchParams) {
    return Object.fromEntries(input);
  }
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      out[key] = value[0];
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function parseLeadsListParams(input: RawParams): LeadsListParams {
  const record = toRecord(input);
  // Apenas chaves conhecidas; o `.strict()` quebraria com query strings extras.
  const subset = {
    page: record.page,
    pageSize: record.pageSize,
    sortBy: record.sortBy,
    sortDir: record.sortDir,
  };
  const parsed = leadsListParamsSchema.parse(subset);
  // O `refine` narrowing não propaga via inferência do Zod 4 com `.coerce`,
  // então tipamos explicitamente — o `refine` já garante o valor literal.
  return {
    page: parsed.page,
    pageSize: parsed.pageSize as LeadPageSize,
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir,
  };
}
