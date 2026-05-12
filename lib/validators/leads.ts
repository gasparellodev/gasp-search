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

export const LEAD_STAGES = [
  "new",
  "contacted",
  "in_conversation",
  "qualified",
  "closed_won",
  "closed_lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  "google_maps",
  "instagram",
  "website_contact",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

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

// Filtros (paramêtros opcionais) para a listagem.

export type LeadFilters = {
  q: string | undefined;
  stage: LeadStage | undefined;
  source: LeadSource | undefined;
  hasWebsite: boolean | undefined;
  tagIds: string[] | undefined;
};

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function pickStrings(
  value: string | string[] | undefined,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const flat = value.flatMap((v) => v.split(",")).map((v) => v.trim());
    const filtered = flat.filter((v) => v.length > 0);
    return filtered.length > 0 ? filtered : undefined;
  }
  const list = value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return list.length > 0 ? list : undefined;
}

function parseFilters(
  raw: Record<string, string | string[] | undefined>,
): LeadFilters {
  const qRaw = pickString(raw.q)?.trim();
  const q = qRaw && qRaw.length >= 2 ? qRaw : undefined;

  const stageRaw = pickString(raw.stage);
  const stage = (LEAD_STAGES as readonly string[]).includes(stageRaw ?? "")
    ? (stageRaw as LeadStage)
    : undefined;

  const sourceRaw = pickString(raw.source);
  const source = (LEAD_SOURCES as readonly string[]).includes(sourceRaw ?? "")
    ? (sourceRaw as LeadSource)
    : undefined;

  const hasWebsiteRaw = pickString(raw.hasWebsite);
  let hasWebsite: boolean | undefined;
  if (hasWebsiteRaw === "true") hasWebsite = true;
  else if (hasWebsiteRaw === "false") hasWebsite = false;

  const tagIds = pickStrings(raw.tagId);

  return { q, stage, source, hasWebsite, tagIds };
}

export type LeadsListInput = {
  params: LeadsListParams;
  filters: LeadFilters;
};

export function parseLeadsListInput(input: RawParams): LeadsListInput {
  const params = parseLeadsListParams(input);
  const record =
    input instanceof URLSearchParams
      ? // Preservar repetição de keys em URLSearchParams para arrays
        Object.fromEntries(
          Array.from(input.keys()).map((key) => [
            key,
            input.getAll(key),
          ]),
        )
      : input;
  const filters = parseFilters(
    record as Record<string, string | string[] | undefined>,
  );
  return { params, filters };
}

// Schemas de mutação --------------------------------------------------------

const stageSchema = z.enum(LEAD_STAGES);
const sourceSchema = z.enum(LEAD_SOURCES);
const scoreSchema = z.number().int().min(0).max(100);
const uuidArraySchema = z.array(z.string().uuid()).max(50);

const optionalString = (max: number) =>
  z.string().trim().max(max).optional().nullable();

// SSRF guard para campo `website` (issue #138). Bloqueia hosts privados,
// loopback, link-local, CGNAT e schemes não-http(s). Defense-in-depth:
// mesmo que código consumidor passe a URL para `fetch`, validator rejeita
// vetores comuns de SSRF (AWS metadata 169.254.169.254, RFC1918, etc).
//
// NOTE: Validação estática (parse-time). Não cobre DNS rebinding (host
// público que resolve para IP privado em runtime). Caso o uso evolua para
// fetch server-side, exigir resolução DNS + revalidação por request.
export function isPrivateOrReservedHost(hostname: string): boolean {
  const lc = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (lc === "localhost" || lc === "::1" || lc === "::") return true;

  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(lc);
  if (ipv4) {
    const octets = [
      Number(ipv4[1]),
      Number(ipv4[2]),
      Number(ipv4[3]),
      Number(ipv4[4]),
    ];
    if (!octets.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      return true;
    }
    const [a, b] = octets as [number, number, number, number];
    if (a === 0) return true;
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }

  if (lc.startsWith("fc") || lc.startsWith("fd")) return true;
  if (lc.startsWith("fe80:")) return true;

  return false;
}

function isPublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (!url.hostname) return false;
  if (isPrivateOrReservedHost(url.hostname)) return false;
  return true;
}

const websiteSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => value === "" || isPublicHttpUrl(value),
    "URL inválida ou aponta para host privado",
  )
  .optional()
  .nullable();

export const createLeadSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    source: sourceSchema,
    category: optionalString(80),
    city: optionalString(80),
    state: optionalString(40),
    country: optionalString(40),
    phone: optionalString(40),
    email: optionalString(160),
    website: websiteSchema,
    instagram_handle: optionalString(60),
    whatsapp: optionalString(40),
    has_website: z.boolean().optional().nullable(),
    notes: optionalString(2000),
    stage: stageSchema.optional(),
    score: scoreSchema.optional(),
    tagIds: uuidArraySchema.optional(),
  })
  .strict();

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    category: optionalString(80),
    city: optionalString(80),
    state: optionalString(40),
    country: optionalString(40),
    phone: optionalString(40),
    email: optionalString(160),
    website: websiteSchema,
    instagram_handle: optionalString(60),
    whatsapp: optionalString(40),
    has_website: z.boolean().optional().nullable(),
    notes: optionalString(2000),
    stage: stageSchema.optional(),
    score: scoreSchema.optional(),
    tagIds: uuidArraySchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Body precisa ter ao menos um campo",
  });

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
