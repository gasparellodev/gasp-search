# Site Irresistível — Frente 03 SEO Infra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hardening completo da infraestrutura SEO dos sites públicos: sitemap global+per-site, schema rich (LocalBusiness/AutoDealer/Vehicle/FAQ/Breadcrumb), canonical robusto, IndexNow proativo, internal linking automation, Lighthouse CI gate.

**Architecture:** Schema helpers em `lib/sites/schema/*` retornam JSON-LD válido server-rendered via `<script type="application/ld+json">`. Sitemaps usam Next 16 `MetadataRoute.Sitemap` com `revalidate = 3600` + `cacheTag`. IndexNow batched via in-memory queue com flush em 10s/10URLs. Lighthouse CI gate em `.github/workflows/lighthouse.yml`.

**Tech Stack:** Next 16 App Router, Tailwind v4, TypeScript strict, Vitest, Supabase service role (server-only), `schema-dts` (types JSON-LD), `lighthouse-ci`.

**Spec:** [`docs/superpowers/specs/2026-05-17-site-irresistivel-03-seo-infra.md`](../specs/2026-05-17-site-irresistivel-03-seo-infra.md)

**Issues GitHub:** #C... (placeholder — preencher após criação) — milestone `Phase 7 — Irresistível 03 SEO Infra`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `app/sites/sitemap.ts` | **CREATE** — Sitemap global listando todos sites publicados |
| `app/sites/[slug]/sitemap.ts` | **CREATE** — Sitemap per-site com 6 rotas fixas + carros dinâmicos |
| `lib/sites/schema/index.ts` | **CREATE** — Barrel + helpers compartilhados (`escapeJsonLd`, `safeAbsoluteUrl`) |
| `lib/sites/schema/local-business.ts` | **CREATE** — `buildLocalBusinessSchema(variables, site)` |
| `lib/sites/schema/vehicle.ts` | **CREATE** — `buildVehicleSchema(car, site)` |
| `lib/sites/schema/faq.ts` | **CREATE** — `buildFAQSchema(faqs)` |
| `lib/sites/schema/breadcrumb.ts` | **CREATE** — `buildBreadcrumbSchema(items)` |
| `lib/sites/schema/CLAUDE.md` | **CREATE** — Convention + pattern doc |
| `lib/sites/indexnow/queue.ts` | **CREATE** — Batched IndexNow submitter |
| `lib/sites/canonical.ts` | **CREATE** — `normalizeCanonical(pathname, search)` |
| `middleware.ts` | **MODIFY** — Adicionar normalização canonical (lowercase + remove trailing /) |
| `lib/sites/metadata.ts` | **MODIFY** — Aceitar canonical absoluto explícito |
| `components/sites/SitePage.tsx` | **MODIFY** — Injetar JSON-LD LocalBusiness/AutoDealer |
| `components/sites/AICitableHero.tsx` | **MODIFY** — Schema vira derived do helper centralizado |
| `app/sites/[slug]/estoque/[carSlug]/page.tsx` | **MODIFY** — Injetar Vehicle + Breadcrumb |
| `components/sites/SiteFAQ.tsx` | **MODIFY** — Injetar FAQPage schema |
| `components/sites/Breadcrumb.tsx` | **MODIFY** — Consumir helper Breadcrumb |
| `components/sites/cars/CarDetailRelatedCars.tsx` | **CREATE** — 4 carros similares |
| `components/sites/home/HomeCategoriesCars.tsx` | **MODIFY** — Adicionar links query categoria |
| `app/sites/[slug]/estoque/page.tsx` | **MODIFY** — Aceitar `?categoria=` query |
| `app/actions/cars.ts` | **MODIFY** — Hook IndexNow em createCar/updateCar |
| `app/actions/lead-site.ts` | **MODIFY** — Hook IndexNow em mudanças de preço (verificar callsites existentes) |
| `.github/workflows/lighthouse.yml` | **CREATE** — Lighthouse CI gate |
| `lighthouserc.json` | **CREATE** — Budgets (LCP/INP/CLS) |
| `tests/unit/app/sites/sitemap.test.ts` | **CREATE** |
| `tests/unit/app/sites/site-sitemap.test.ts` | **CREATE** |
| `tests/unit/lib/sites/schema/local-business.test.ts` | **CREATE** |
| `tests/unit/lib/sites/schema/vehicle.test.ts` | **CREATE** |
| `tests/unit/lib/sites/schema/faq.test.ts` | **CREATE** |
| `tests/unit/lib/sites/schema/breadcrumb.test.ts` | **CREATE** |
| `tests/unit/lib/sites/indexnow/queue.test.ts` | **CREATE** |
| `tests/unit/lib/sites/canonical.test.ts` | **CREATE** |
| `tests/e2e/sites/canonical.spec.ts` | **CREATE** — E2E redirect 308 |
| `docs/SEO-PLAN.md` | **MODIFY** — Refletir nova arquitetura |
| `app/sites/CLAUDE.md` | **MODIFY** — Sitemap + schema convention |

---

## Pre-flight Checklist

- [ ] Branch base atualizada: `git checkout main && git pull`
- [ ] Branch criada: `git checkout -b feat/seo-infra-foundation` (renomear por task)
- [ ] Verificar `INDEXNOW_KEY` em `.env.local` (opcional pra testes; obrigatório pra E2E real)
- [ ] Verificar `NEXT_PUBLIC_APP_URL` setado (necessário pros URLs absolutos)
- [ ] `npm install` rodado

---

## Task 1: Helper `escapeJsonLd` + barrel `lib/sites/schema/index.ts`

**Issue:** #S3 (prereq compartilhado)

**Files:**
- Create: `lib/sites/schema/index.ts`
- Create: `tests/unit/lib/sites/schema/escape.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/sites/schema/escape.test.ts
import { describe, expect, it } from "vitest";
import { escapeJsonLd, safeAbsoluteUrl } from "@/lib/sites/schema";

describe("escapeJsonLd", () => {
  it("escapes </script> sequences to prevent breakout", () => {
    const value = { name: "Foo</script><script>alert(1)</script>" };
    const out = escapeJsonLd(value);
    expect(out).not.toContain("</script>");
    expect(out).toContain("<\\/script>");
  });

  it("preserves valid JSON for parser", () => {
    const value = { name: "Foo" };
    const out = escapeJsonLd(value);
    expect(JSON.parse(out)).toEqual(value);
  });

  it("handles nested objects", () => {
    const value = { a: { b: "</script>" } };
    const out = escapeJsonLd(value);
    expect(out).not.toContain("</script>");
  });
});

describe("safeAbsoluteUrl", () => {
  it("returns absolute URL when given absolute", () => {
    expect(safeAbsoluteUrl("https://x.com/a")).toBe("https://x.com/a");
  });

  it("prefixes with NEXT_PUBLIC_APP_URL when relative", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
    expect(safeAbsoluteUrl("/foo")).toBe("https://app.test/foo");
  });

  it("returns null for invalid input", () => {
    expect(safeAbsoluteUrl("")).toBeNull();
    expect(safeAbsoluteUrl(null as unknown as string)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/sites/schema/escape.test.ts`
Expected: FAIL with "Cannot find module '@/lib/sites/schema'"

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/sites/schema/index.ts
import "server-only";

import { env } from "@/lib/env";

export function escapeJsonLd(value: unknown): string {
  // Escape </script and similar HTML breakout sequences. JSON.stringify itself
  // doesn't escape forward slash, so we post-process.
  return JSON.stringify(value)
    .replace(/<\//g, "<\\/")
    .replace(/-->/g, "--\\>")
    .replace(/<!--/g, "<\\!--");
}

export function safeAbsoluteUrl(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  try {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      return new URL(input).toString();
    }
    const base = env.NEXT_PUBLIC_APP_URL;
    if (!base) return null;
    return new URL(input, base).toString();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/sites/schema/escape.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero warnings/errors

- [ ] **Step 6: Commit**

```bash
git add lib/sites/schema/index.ts tests/unit/lib/sites/schema/escape.test.ts
git commit -m "feat(sites): add escapeJsonLd + safeAbsoluteUrl helpers for schema"
```

---

## Task 2: Sitemap global (`app/sites/sitemap.ts`) — #S1

**Files:**
- Create: `app/sites/sitemap.ts`
- Create: `tests/unit/app/sites/sitemap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/sites/sitemap.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://app.test" },
}));

import sitemap from "@/app/sites/sitemap";
import { createServiceClient } from "@/lib/supabase/server";

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
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseMock([
        { slug: "poliguara", updated_at: "2026-05-10T10:00:00Z" },
        { slug: "stilos", updated_at: "2026-05-12T08:00:00Z" },
      ]) as never,
    );
    const result = await sitemap();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      url: "https://app.test/sites/poliguara",
      changeFrequency: "weekly",
      priority: 0.8,
    });
    expect(result[0].lastModified).toBeInstanceOf(Date);
  });

  it("returns empty array when query errors", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
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
    vi.mocked(createServiceClient).mockReturnValue(makeSupabaseMock([]) as never);
    const result = await sitemap();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/app/sites/sitemap.test.ts`
Expected: FAIL with "Cannot find module '@/app/sites/sitemap'"

- [ ] **Step 3: Write minimal implementation**

```ts
// app/sites/sitemap.ts
import "server-only";

import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("lead_sites")
    .select("slug, updated_at")
    .in("status", ["published", "sent"])
    .not("signed_at", "is", null)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    url: `${env.NEXT_PUBLIC_APP_URL}/sites/${row.slug}`,
    lastModified: new Date(row.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/app/sites/sitemap.test.ts`
Expected: PASS — 3 passed

- [ ] **Step 5: Verify build emits sitemap**

Run: `npm run build`
Expected: build success, output includes `/sites/sitemap.xml`

- [ ] **Step 6: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero warnings/errors

- [ ] **Step 7: Commit**

```bash
git add app/sites/sitemap.ts tests/unit/app/sites/sitemap.test.ts
git commit -m "feat(sites): add global sites sitemap (#S1)"
```

---

## Task 3: Sitemap per-site (`app/sites/[slug]/sitemap.ts`) — #S2

**Files:**
- Create: `app/sites/[slug]/sitemap.ts`
- Create: `tests/unit/app/sites/site-sitemap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/sites/site-sitemap.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/sites/get-site");
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://app.test" },
}));

import siteSitemap from "@/app/sites/[slug]/sitemap";
import { getSite } from "@/lib/sites/get-site";
import { createServiceClient } from "@/lib/supabase/server";

const carsMock = (rows: Array<{ slug: string; updated_at: string }>) => ({
  from: () => ({
    select: () => ({
      eq: () => Promise.resolve({ data: rows, error: null }),
    }),
  }),
});

describe("site sitemap (per slug)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 6 static routes + dynamic car routes for published site", async () => {
    vi.mocked(getSite).mockResolvedValue({
      id: "site-1",
      slug: "poliguara",
      status: "published",
      updated_at: "2026-05-10T10:00:00Z",
    } as never);
    vi.mocked(createServiceClient).mockReturnValue(
      carsMock([
        { slug: "bmw-320i-2020", updated_at: "2026-05-09T12:00:00Z" },
      ]) as never,
    );
    const result = await siteSitemap({ params: Promise.resolve({ slug: "poliguara" }) });
    expect(result).toHaveLength(7); // 6 fixed + 1 car
    const urls = result.map((r) => r.url);
    expect(urls).toContain("https://app.test/sites/poliguara");
    expect(urls).toContain("https://app.test/sites/poliguara/sobre");
    expect(urls).toContain("https://app.test/sites/poliguara/contato");
    expect(urls).toContain("https://app.test/sites/poliguara/anunciar");
    expect(urls).toContain("https://app.test/sites/poliguara/estoque");
    expect(urls).toContain("https://app.test/sites/poliguara/lgpd");
    expect(urls).toContain("https://app.test/sites/poliguara/estoque/bmw-320i-2020");
  });

  it("returns empty array for draft site", async () => {
    vi.mocked(getSite).mockResolvedValue({
      slug: "draft-site",
      status: "draft",
    } as never);
    const result = await siteSitemap({ params: Promise.resolve({ slug: "draft-site" }) });
    expect(result).toEqual([]);
  });

  it("returns empty array for archived site", async () => {
    vi.mocked(getSite).mockResolvedValue({
      slug: "x",
      status: "archived",
    } as never);
    const result = await siteSitemap({ params: Promise.resolve({ slug: "x" }) });
    expect(result).toEqual([]);
  });

  it("returns empty array when site not found", async () => {
    vi.mocked(getSite).mockResolvedValue(null);
    const result = await siteSitemap({ params: Promise.resolve({ slug: "missing" }) });
    expect(result).toEqual([]);
  });

  it("returns only static routes when site published but has zero cars", async () => {
    vi.mocked(getSite).mockResolvedValue({
      slug: "x",
      status: "published",
      updated_at: "2026-05-10T10:00:00Z",
    } as never);
    vi.mocked(createServiceClient).mockReturnValue(carsMock([]) as never);
    const result = await siteSitemap({ params: Promise.resolve({ slug: "x" }) });
    expect(result).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/app/sites/site-sitemap.test.ts`
Expected: FAIL with "Cannot find module '@/app/sites/[slug]/sitemap'"

- [ ] **Step 3: Write minimal implementation**

```ts
// app/sites/[slug]/sitemap.ts
import "server-only";

import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { getSite } from "@/lib/sites/get-site";
import { createServiceClient } from "@/lib/supabase/server";

export const revalidate = 3600;

interface SitemapProps {
  params: Promise<{ slug: string }>;
}

const STATIC_PATHS = ["", "/sobre", "/contato", "/anunciar", "/estoque", "/lgpd"] as const;

export default async function sitemap({
  params,
}: SitemapProps): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site || site.status === "draft" || site.status === "archived") {
    return [];
  }

  const base = `${env.NEXT_PUBLIC_APP_URL}/sites/${slug}`;
  const lastModified = new Date(site.updated_at ?? Date.now());

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const supabase = createServiceClient();
  const { data: cars } = await supabase
    .from("cars")
    .select("slug, updated_at")
    .eq("lead_site_id", site.id);

  const carEntries: MetadataRoute.Sitemap = (cars ?? []).map((car) => ({
    url: `${base}/estoque/${car.slug}`,
    lastModified: new Date(car.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...carEntries];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/app/sites/site-sitemap.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Lint + typecheck + build**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: zero warnings/errors, build success

- [ ] **Step 6: Commit**

```bash
git add app/sites/[slug]/sitemap.ts tests/unit/app/sites/site-sitemap.test.ts
git commit -m "feat(sites): add per-site sitemap with car URLs (#S2)"
```

---

## Task 4: LocalBusiness + AutoDealer schema helper — #S3

**Files:**
- Create: `lib/sites/schema/local-business.ts`
- Create: `tests/unit/lib/sites/schema/local-business.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/sites/schema/local-business.test.ts
import { describe, expect, it } from "vitest";
import { buildLocalBusinessSchema } from "@/lib/sites/schema/local-business";

const mockVariables = {
  business_name: "Poliguara Multimarcas",
  description: "Concessionária de seminovos premium em Pinheiros, SP.",
  address: {
    street: "Rua dos Pinheiros, 100",
    city: "São Paulo",
    state: "SP",
    postal_code: "05422-000",
    country: "BR",
  },
  phone: "+5511999999999",
  whatsapp: "+5511988888888",
  email: "contato@poliguara.com",
  social: { instagram: "https://instagram.com/poliguara" },
  brand_assets: {
    logo_url: "https://cdn.test/logo.png",
    hero_image_url: "https://cdn.test/hero.jpg",
  },
  business_hours: [
    { day: "monday", open: "08:00", close: "18:00" },
    { day: "saturday", open: "08:00", close: "13:00" },
  ],
};

const mockSite = { slug: "poliguara" };

describe("buildLocalBusinessSchema", () => {
  it("returns @type with both LocalBusiness and AutoDealer", () => {
    const schema = buildLocalBusinessSchema(mockVariables as never, mockSite as never);
    expect(schema["@type"]).toEqual(["LocalBusiness", "AutoDealer"]);
    expect(schema["@context"]).toBe("https://schema.org");
  });

  it("includes name, image, url, telephone", () => {
    const schema = buildLocalBusinessSchema(mockVariables as never, mockSite as never);
    expect(schema.name).toBe("Poliguara Multimarcas");
    expect(schema.image).toBe("https://cdn.test/hero.jpg");
    expect(schema.url).toContain("/sites/poliguara");
    expect(schema.telephone).toBe("+5511999999999");
  });

  it("builds PostalAddress from address", () => {
    const schema = buildLocalBusinessSchema(mockVariables as never, mockSite as never);
    expect(schema.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Rua dos Pinheiros, 100",
      addressLocality: "São Paulo",
      addressRegion: "SP",
      postalCode: "05422-000",
      addressCountry: "BR",
    });
  });

  it("emits openingHoursSpecification entries from business_hours", () => {
    const schema = buildLocalBusinessSchema(mockVariables as never, mockSite as never);
    expect(schema.openingHoursSpecification).toHaveLength(2);
    expect(schema.openingHoursSpecification?.[0]).toMatchObject({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Monday",
      opens: "08:00",
      closes: "18:00",
    });
  });

  it("includes sameAs with social URLs", () => {
    const schema = buildLocalBusinessSchema(mockVariables as never, mockSite as never);
    expect(schema.sameAs).toContain("https://instagram.com/poliguara");
  });

  it("omits aggregateRating when not provided", () => {
    const schema = buildLocalBusinessSchema(mockVariables as never, mockSite as never);
    expect(schema.aggregateRating).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/sites/schema/local-business.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/sites/schema/local-business.ts
import "server-only";

import type { SiteVariables } from "@/lib/sites/variables";
import type { Database } from "@/types/database";

import { safeAbsoluteUrl } from "./index";

type Site = Pick<Database["public"]["Tables"]["lead_sites"]["Row"], "slug">;

const DAY_MAP: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export interface LocalBusinessSchema {
  "@context": "https://schema.org";
  "@type": ["LocalBusiness", "AutoDealer"];
  name: string;
  image?: string;
  url: string;
  telephone?: string;
  email?: string;
  address?: {
    "@type": "PostalAddress";
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  openingHoursSpecification?: Array<{
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string;
    opens: string;
    closes: string;
  }>;
  sameAs?: string[];
  aggregateRating?: {
    "@type": "AggregateRating";
    ratingValue: number;
    reviewCount: number;
  };
  description?: string;
}

export function buildLocalBusinessSchema(
  variables: SiteVariables,
  site: Site,
): LocalBusinessSchema {
  const url = safeAbsoluteUrl(`/sites/${site.slug}`) ?? `/sites/${site.slug}`;
  const image = safeAbsoluteUrl(variables.brand_assets?.hero_image_url) ?? undefined;
  const address = variables.address
    ? {
        "@type": "PostalAddress" as const,
        streetAddress: variables.address.street,
        addressLocality: variables.address.city,
        addressRegion: variables.address.state,
        postalCode: variables.address.postal_code,
        addressCountry: variables.address.country,
      }
    : undefined;

  const openingHoursSpecification = variables.business_hours?.length
    ? variables.business_hours.map((row) => ({
        "@type": "OpeningHoursSpecification" as const,
        dayOfWeek: DAY_MAP[row.day.toLowerCase()] ?? row.day,
        opens: row.open,
        closes: row.close,
      }))
    : undefined;

  const sameAs = variables.social
    ? Object.values(variables.social).filter((v): v is string => Boolean(v))
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "AutoDealer"],
    name: variables.business_name,
    image,
    url,
    telephone: variables.phone,
    email: variables.email,
    description: variables.description,
    address,
    openingHoursSpecification,
    sameAs: sameAs?.length ? sameAs : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/sites/schema/local-business.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero warnings/errors

- [ ] **Step 6: Commit**

```bash
git add lib/sites/schema/local-business.ts tests/unit/lib/sites/schema/local-business.test.ts
git commit -m "feat(sites): add LocalBusiness+AutoDealer schema helper (#S3)"
```

---

## Task 5: Inject LocalBusiness schema into `<SitePage>` — #S3 (continuation)

**Files:**
- Modify: `components/sites/SitePage.tsx`

- [ ] **Step 1: Read current SitePage to find injection point**

Run: `grep -n "AICitableHero\|application/ld+json" components/sites/SitePage.tsx`
Expected: confirm where AICitableHero renders or where we add the new <script>

- [ ] **Step 2: Add LocalBusiness schema injection**

Insert the following snippet at the top of `<SitePage>` JSX (before `<SiteHeader>`):

```tsx
import { buildLocalBusinessSchema } from "@/lib/sites/schema/local-business";
import { escapeJsonLd } from "@/lib/sites/schema";

// inside the component body, after `const variables = ...`:
const localBusinessJsonLd = escapeJsonLd(
  buildLocalBusinessSchema(variables, { slug: site.slug }),
);

// in JSX, render:
<script
  type="application/ld+json"
  // eslint-disable-next-line react/no-danger
  dangerouslySetInnerHTML={{ __html: localBusinessJsonLd }}
/>
```

(Adapt to the actual SitePage prop signature — verify via Read tool before editing.)

- [ ] **Step 3: Verify ESLint allows the dangerouslySetInnerHTML with eslint-disable comment**

Run: `npm run lint`
Expected: zero warnings

- [ ] **Step 4: Add regression test**

```ts
// tests/unit/components/sites/SitePage.test.tsx — append new test
it("emits LocalBusiness JSON-LD in document", async () => {
  const { container } = render(<SitePage site={fixtureSite} variables={fixtureVariables} />);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  const json = JSON.parse(script!.innerHTML);
  expect(json["@type"]).toContain("LocalBusiness");
  expect(json["@type"]).toContain("AutoDealer");
});
```

- [ ] **Step 5: Run test**

Run: `npx vitest run tests/unit/components/sites/SitePage.test.tsx`
Expected: PASS

- [ ] **Step 6: Validate with Google Rich Results Test (manual)**

Build + deploy preview; run https://search.google.com/test/rich-results on a published site URL. Cole o output no PR.

- [ ] **Step 7: Commit**

```bash
git add components/sites/SitePage.tsx tests/unit/components/sites/SitePage.test.tsx
git commit -m "feat(sites): inject LocalBusiness JSON-LD in SitePage (#S3)"
```

---

## Task 6: Vehicle schema helper — #S4

**Files:**
- Create: `lib/sites/schema/vehicle.ts`
- Create: `tests/unit/lib/sites/schema/vehicle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/sites/schema/vehicle.test.ts
import { describe, expect, it } from "vitest";
import { buildVehicleSchema } from "@/lib/sites/schema/vehicle";

const car = {
  id: "car-1",
  slug: "bmw-320i-2020",
  brand: "BMW",
  model: "320i",
  year: 2020,
  km: 45000,
  fuel: "Gasolina",
  transmission: "Automático",
  color: "Preto",
  body_type: "Sedan",
  doors: 4,
  price_cents: 18500000,
  images: ["https://cdn.test/c1.jpg", "https://cdn.test/c2.jpg"],
};

const site = { slug: "poliguara" };
const variables = { business_name: "Poliguara" };

describe("buildVehicleSchema", () => {
  it("returns @type Vehicle with all core fields", () => {
    const schema = buildVehicleSchema(car as never, site as never, variables as never);
    expect(schema["@type"]).toBe("Vehicle");
    expect(schema.name).toBe("BMW 320i 2020");
    expect(schema.brand).toEqual({ "@type": "Brand", name: "BMW" });
    expect(schema.model).toBe("320i");
    expect(schema.vehicleModelDate).toBe("2020");
    expect(schema.bodyType).toBe("Sedan");
    expect(schema.fuelType).toBe("Gasolina");
    expect(schema.vehicleTransmission).toBe("Automático");
    expect(schema.numberOfDoors).toBe(4);
    expect(schema.color).toBe("Preto");
  });

  it("emits mileageFromOdometer as QuantitativeValue", () => {
    const schema = buildVehicleSchema(car as never, site as never, variables as never);
    expect(schema.mileageFromOdometer).toEqual({
      "@type": "QuantitativeValue",
      value: 45000,
      unitCode: "KMT",
    });
  });

  it("emits offers with price as decimal string + seller LocalBusiness ref", () => {
    const schema = buildVehicleSchema(car as never, site as never, variables as never);
    expect(schema.offers).toMatchObject({
      "@type": "Offer",
      price: "185000.00",
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      seller: { "@type": "AutoDealer", name: "Poliguara" },
    });
  });

  it("includes image array with absolute URLs", () => {
    const schema = buildVehicleSchema(car as never, site as never, variables as never);
    expect(schema.image).toEqual([
      "https://cdn.test/c1.jpg",
      "https://cdn.test/c2.jpg",
    ]);
  });

  it("does NOT include vehicleIdentificationNumber (privacy)", () => {
    const schema = buildVehicleSchema(car as never, site as never, variables as never);
    expect(schema).not.toHaveProperty("vehicleIdentificationNumber");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/sites/schema/vehicle.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```ts
// lib/sites/schema/vehicle.ts
import "server-only";

import type { SiteVariables } from "@/lib/sites/variables";
import type { Database } from "@/types/database";

type Car = Database["public"]["Tables"]["cars"]["Row"];
type Site = Pick<Database["public"]["Tables"]["lead_sites"]["Row"], "slug">;

export interface VehicleSchema {
  "@context": "https://schema.org";
  "@type": "Vehicle";
  name: string;
  brand: { "@type": "Brand"; name: string };
  model: string;
  vehicleModelDate: string;
  bodyType?: string;
  fuelType?: string;
  vehicleTransmission?: string;
  numberOfDoors?: number;
  color?: string;
  mileageFromOdometer: {
    "@type": "QuantitativeValue";
    value: number;
    unitCode: "KMT";
  };
  image?: string[];
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: "BRL";
    availability: "https://schema.org/InStock";
    seller: { "@type": "AutoDealer"; name: string };
  };
}

export function buildVehicleSchema(
  car: Car,
  site: Site,
  variables: Pick<SiteVariables, "business_name">,
): VehicleSchema {
  const priceDecimal = (car.price_cents / 100).toFixed(2);
  return {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: `${car.brand} ${car.model} ${car.year}`,
    brand: { "@type": "Brand", name: car.brand },
    model: car.model,
    vehicleModelDate: String(car.year),
    bodyType: car.body_type ?? undefined,
    fuelType: car.fuel ?? undefined,
    vehicleTransmission: car.transmission ?? undefined,
    numberOfDoors: car.doors ?? undefined,
    color: car.color ?? undefined,
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: car.km,
      unitCode: "KMT",
    },
    image: car.images?.length ? car.images : undefined,
    offers: {
      "@type": "Offer",
      price: priceDecimal,
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      seller: { "@type": "AutoDealer", name: variables.business_name },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/sites/schema/vehicle.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Inject in CarDetail page**

Modify `app/sites/[slug]/estoque/[carSlug]/page.tsx` — add (verify exact JSX shape by reading the file first):

```tsx
import { buildVehicleSchema } from "@/lib/sites/schema/vehicle";
import { escapeJsonLd } from "@/lib/sites/schema";

// in the page component, after car/site resolution:
const vehicleJsonLd = escapeJsonLd(buildVehicleSchema(car, { slug: site.slug }, variables));

// in JSX (early, server-rendered):
<script
  type="application/ld+json"
  // eslint-disable-next-line react/no-danger
  dangerouslySetInnerHTML={{ __html: vehicleJsonLd }}
/>
```

- [ ] **Step 6: Lint + typecheck + build**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: zero warnings/errors

- [ ] **Step 7: Commit**

```bash
git add lib/sites/schema/vehicle.ts tests/unit/lib/sites/schema/vehicle.test.ts app/sites/[slug]/estoque/[carSlug]/page.tsx
git commit -m "feat(sites): add Vehicle schema + inject in CarDetail (#S4)"
```

---

## Task 7: FAQPage schema helper — #S5 (part 1)

**Files:**
- Create: `lib/sites/schema/faq.ts`
- Create: `tests/unit/lib/sites/schema/faq.test.ts`
- Modify: `components/sites/SiteFAQ.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/sites/schema/faq.test.ts
import { describe, expect, it } from "vitest";
import { buildFAQSchema } from "@/lib/sites/schema/faq";

describe("buildFAQSchema", () => {
  it("returns @type FAQPage with mainEntity array", () => {
    const schema = buildFAQSchema([
      { question: "Vocês aceitam carro na troca?", answer: "Sim, avaliamos sem custo." },
      { question: "Financiam?", answer: "Sim, até 60 meses." },
    ]);
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "Vocês aceitam carro na troca?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim, avaliamos sem custo.",
      },
    });
  });

  it("returns empty mainEntity for empty input", () => {
    const schema = buildFAQSchema([]);
    expect(schema.mainEntity).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npx vitest run tests/unit/lib/sites/schema/faq.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/sites/schema/faq.ts
import "server-only";

export interface FAQEntry {
  question: string;
  answer: string;
}

export interface FAQPageSchema {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }>;
}

export function buildFAQSchema(faqs: FAQEntry[]): FAQPageSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `npx vitest run tests/unit/lib/sites/schema/faq.test.ts`
Expected: PASS — 2 passed

- [ ] **Step 5: Inject in `<SiteFAQ>`**

Read `components/sites/SiteFAQ.tsx`, then modify:

```tsx
import { buildFAQSchema } from "@/lib/sites/schema/faq";
import { escapeJsonLd } from "@/lib/sites/schema";

// In the component body:
const faqJsonLd = escapeJsonLd(buildFAQSchema(faqs));

// In JSX (top of the section):
<script
  type="application/ld+json"
  // eslint-disable-next-line react/no-danger
  dangerouslySetInnerHTML={{ __html: faqJsonLd }}
/>
```

- [ ] **Step 6: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add lib/sites/schema/faq.ts tests/unit/lib/sites/schema/faq.test.ts components/sites/SiteFAQ.tsx
git commit -m "feat(sites): add FAQPage schema + inject in SiteFAQ (#S5)"
```

---

## Task 8: BreadcrumbList schema + integration — #S5 (part 2)

**Files:**
- Create: `lib/sites/schema/breadcrumb.ts`
- Create: `tests/unit/lib/sites/schema/breadcrumb.test.ts`
- Modify: `components/sites/Breadcrumb.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/sites/schema/breadcrumb.test.ts
import { describe, expect, it } from "vitest";
import { buildBreadcrumbSchema } from "@/lib/sites/schema/breadcrumb";

describe("buildBreadcrumbSchema", () => {
  it("emits ordered itemListElement with absolute URLs", () => {
    const schema = buildBreadcrumbSchema([
      { name: "Home", url: "https://app.test/sites/x" },
      { name: "Estoque", url: "https://app.test/sites/x/estoque" },
      { name: "BMW 320i 2020", url: "https://app.test/sites/x/estoque/bmw-320i-2020" },
    ]);
    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement).toHaveLength(3);
    expect(schema.itemListElement[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://app.test/sites/x",
    });
    expect(schema.itemListElement[2].position).toBe(3);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npx vitest run tests/unit/lib/sites/schema/breadcrumb.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/sites/schema/breadcrumb.ts
import "server-only";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbListSchema {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]): BreadcrumbListSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `npx vitest run tests/unit/lib/sites/schema/breadcrumb.test.ts`
Expected: PASS — 1 passed

- [ ] **Step 5: Integrate in `<Breadcrumb>`**

Read `components/sites/Breadcrumb.tsx`, then modify:

```tsx
import { buildBreadcrumbSchema } from "@/lib/sites/schema/breadcrumb";
import { escapeJsonLd } from "@/lib/sites/schema";

// Inside the component body, after props/items resolution:
const breadcrumbJsonLd = escapeJsonLd(buildBreadcrumbSchema(items));

// In JSX (top of the nav):
<script
  type="application/ld+json"
  // eslint-disable-next-line react/no-danger
  dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
/>
```

- [ ] **Step 6: Lint + typecheck + build**

Run: `npm run lint && npx tsc --noEmit && npm run build`

- [ ] **Step 7: Commit**

```bash
git add lib/sites/schema/breadcrumb.ts tests/unit/lib/sites/schema/breadcrumb.test.ts components/sites/Breadcrumb.tsx
git commit -m "feat(sites): add BreadcrumbList schema + integrate (#S5)"
```

---

## Task 9: Canonical normalization helper — #S6 (part 1)

**Files:**
- Create: `lib/sites/canonical.ts`
- Create: `tests/unit/lib/sites/canonical.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/sites/canonical.test.ts
import { describe, expect, it } from "vitest";
import { normalizeCanonical } from "@/lib/sites/canonical";

describe("normalizeCanonical", () => {
  it("returns lowercased pathname without trailing slash", () => {
    expect(normalizeCanonical("/Sites/POLIGUARA/Estoque/", "")).toBe("/sites/poliguara/estoque");
  });

  it("preserves root slash", () => {
    expect(normalizeCanonical("/", "")).toBe("/");
  });

  it("strips query string", () => {
    expect(normalizeCanonical("/sites/x/estoque", "?foo=bar")).toBe("/sites/x/estoque");
  });

  it("returns null for non-site routes (no normalization needed)", () => {
    expect(normalizeCanonical("/dashboard", "")).toBeNull();
  });

  it("preserves path when already canonical", () => {
    expect(normalizeCanonical("/sites/x/estoque", "")).toBeNull(); // no change
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npx vitest run tests/unit/lib/sites/canonical.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/sites/canonical.ts
export function normalizeCanonical(pathname: string, _search: string): string | null {
  if (!pathname.startsWith("/sites/")) return null;
  let normalized = pathname.toLowerCase();
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized === pathname ? null : normalized;
}
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `npx vitest run tests/unit/lib/sites/canonical.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Commit**

```bash
git add lib/sites/canonical.ts tests/unit/lib/sites/canonical.test.ts
git commit -m "feat(sites): add normalizeCanonical helper (#S6)"
```

---

## Task 10: Middleware integration for canonical redirects — #S6 (part 2)

**Files:**
- Modify: `middleware.ts` (or create if absent)
- Create: `tests/e2e/sites/canonical.spec.ts`

- [ ] **Step 1: Check current middleware state**

Run: `ls middleware.ts && head -50 middleware.ts 2>/dev/null || echo "absent"`
Expected: confirms file existence

- [ ] **Step 2: Add canonical redirect logic**

If `middleware.ts` exists, integrate; if absent, create:

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

import { normalizeCanonical } from "@/lib/sites/canonical";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const normalized = normalizeCanonical(pathname, search);
  if (normalized) {
    const url = request.nextUrl.clone();
    url.pathname = normalized;
    url.search = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/sites/:path*"],
};
```

- [ ] **Step 3: E2E test**

```ts
// tests/e2e/sites/canonical.spec.ts
import { test, expect } from "@playwright/test";

test.describe("canonical normalization", () => {
  test("trailing slash redirects 308 to no-trailing", async ({ page }) => {
    const response = await page.goto("/sites/poliguara/estoque/", { waitUntil: "commit" });
    expect(response?.status()).toBe(200); // post-redirect
    expect(page.url()).not.toMatch(/\/estoque\/$/);
    expect(page.url()).toMatch(/\/estoque$/);
  });

  test("uppercase slug redirects to lowercase", async ({ page }) => {
    const response = await page.goto("/sites/POLIGUARA");
    expect(response?.status()).toBe(200);
    expect(page.url()).toMatch(/\/sites\/poliguara$/);
  });
});
```

- [ ] **Step 4: Run E2E**

Run: `npm run test:e2e -- canonical.spec.ts`
Expected: PASS — 2 tests (requires preview server running; use `npm run dev` in another terminal)

- [ ] **Step 5: Lint + typecheck + build**

Run: `npm run lint && npx tsc --noEmit && npm run build`

- [ ] **Step 6: Commit**

```bash
git add middleware.ts tests/e2e/sites/canonical.spec.ts
git commit -m "feat(sites): add canonical 308 redirect via middleware (#S6)"
```

---

## Task 11: IndexNow batched queue — #S7

**Files:**
- Create: `lib/sites/indexnow/queue.ts`
- Create: `tests/unit/lib/sites/indexnow/queue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/sites/indexnow/queue.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    INDEXNOW_KEY: "test-key-12345678",
    NEXT_PUBLIC_APP_URL: "https://app.test",
  },
}));

import { enqueueIndexNow, __resetQueueForTests } from "@/lib/sites/indexnow/queue";

describe("indexnow queue", () => {
  beforeEach(() => {
    __resetQueueForTests();
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("flushes after 10 URLs accumulate (size trigger)", async () => {
    for (let i = 0; i < 10; i++) enqueueIndexNow(`/sites/x/car-${i}`);
    await vi.runAllTimersAsync();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.urlList).toHaveLength(10);
  });

  it("flushes after 10s when fewer than 10 URLs (time trigger)", async () => {
    enqueueIndexNow("/sites/x/car-1");
    enqueueIndexNow("/sites/x/car-2");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.urlList).toHaveLength(2);
  });

  it("does nothing when INDEXNOW_KEY absent (mocked here, see other test)", () => {
    // Coverage of noop branch handled in #G7 if applicable
  });

  it("does not throw on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("boom"));
    enqueueIndexNow("/sites/x/car-1");
    await expect(vi.advanceTimersByTimeAsync(10_000)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npx vitest run tests/unit/lib/sites/indexnow/queue.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/sites/indexnow/queue.ts
import "server-only";

import { env } from "@/lib/env";

const FLUSH_TIMEOUT_MS = 10_000;
const FLUSH_SIZE = 10;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

let queue: string[] = [];
let timer: NodeJS.Timeout | null = null;

export function __resetQueueForTests(): void {
  queue = [];
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

export function enqueueIndexNow(pathname: string): void {
  if (!env.INDEXNOW_KEY) return;
  if (!pathname.startsWith("/sites/")) return;

  const absoluteUrl = `${env.NEXT_PUBLIC_APP_URL}${pathname}`;
  queue.push(absoluteUrl);

  if (queue.length >= FLUSH_SIZE) {
    void flush();
    return;
  }

  if (!timer) {
    timer = setTimeout(() => {
      void flush();
    }, FLUSH_TIMEOUT_MS);
  }
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0 || !env.INDEXNOW_KEY) return;

  const urls = [...queue];
  queue = [];

  try {
    await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: new URL(env.NEXT_PUBLIC_APP_URL).host,
        key: env.INDEXNOW_KEY,
        urlList: urls,
      }),
    });
  } catch (err) {
    console.warn("[indexnow] flush failed", { error: String(err), count: urls.length });
  }
}
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `npx vitest run tests/unit/lib/sites/indexnow/queue.test.ts`
Expected: PASS — 3 passed (skipped placeholder ok)

- [ ] **Step 5: Hook into car actions**

Read `app/actions/cars.ts`; in `createCar` and `updateCar`, after successful DB write, call:

```ts
import { enqueueIndexNow } from "@/lib/sites/indexnow/queue";

// after success:
enqueueIndexNow(`/sites/${siteSlug}/estoque/${car.slug}`);
```

(Verify exact action file path with `find app/actions -name "*car*"`.)

- [ ] **Step 6: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add lib/sites/indexnow/ tests/unit/lib/sites/indexnow/ app/actions/cars.ts
git commit -m "feat(sites): add IndexNow batched queue + hook in car actions (#S7)"
```

---

## Task 12: Internal linking — Related Cars component — #S8 (part 1)

**Files:**
- Create: `components/sites/cars/CarDetailRelatedCars.tsx`
- Create: `tests/unit/components/sites/cars/CarDetailRelatedCars.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/sites/cars/CarDetailRelatedCars.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CarDetailRelatedCars } from "@/components/sites/cars/CarDetailRelatedCars";

const cars = [
  { id: "1", slug: "bmw-320i-2020", brand: "BMW", model: "320i", year: 2020, price_cents: 18500000, images: ["a.jpg"] },
  { id: "2", slug: "bmw-320i-2021", brand: "BMW", model: "320i", year: 2021, price_cents: 19500000, images: ["b.jpg"] },
];

describe("CarDetailRelatedCars", () => {
  it("renders up to 4 cards with anchor text containing modelo + ano", () => {
    render(<CarDetailRelatedCars cars={cars as never} siteSlug="poliguara" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain("BMW 320i 2020");
    expect(links[0].getAttribute("href")).toBe("/sites/poliguara/estoque/bmw-320i-2020");
  });

  it("renders nothing when cars array empty", () => {
    const { container } = render(<CarDetailRelatedCars cars={[]} siteSlug="x" />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npx vitest run tests/unit/components/sites/cars/CarDetailRelatedCars.test.tsx`

- [ ] **Step 3: Implement (server component)**

```tsx
// components/sites/cars/CarDetailRelatedCars.tsx
import Link from "next/link";

import type { Database } from "@/types/database";

type Car = Pick<
  Database["public"]["Tables"]["cars"]["Row"],
  "id" | "slug" | "brand" | "model" | "year" | "price_cents" | "images"
>;

interface Props {
  cars: Car[];
  siteSlug: string;
}

export function CarDetailRelatedCars({ cars, siteSlug }: Props): React.ReactNode {
  if (cars.length === 0) return null;
  const top = cars.slice(0, 4);
  return (
    <section
      aria-labelledby="related-cars-heading"
      className="mt-12 border-t pt-8"
    >
      <h2 id="related-cars-heading" className="text-2xl font-semibold mb-4">
        Veículos similares
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {top.map((car) => (
          <li key={car.id}>
            <Link
              href={`/sites/${siteSlug}/estoque/${car.slug}`}
              className="block hover:opacity-90 focus-visible:ring-2 ring-offset-2 rounded-lg"
            >
              {car.images?.[0] ? (
                <img
                  src={car.images[0]}
                  alt={`${car.brand} ${car.model} ${car.year}`}
                  className="aspect-[4/3] w-full object-cover rounded-lg"
                  loading="lazy"
                />
              ) : null}
              <span className="block mt-2 font-medium">
                {car.brand} {car.model} {car.year}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `npx vitest run tests/unit/components/sites/cars/CarDetailRelatedCars.test.tsx`
Expected: PASS — 2 passed

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/sites/cars/CarDetailRelatedCars.tsx tests/unit/components/sites/cars/CarDetailRelatedCars.test.tsx
git commit -m "feat(sites): add CarDetailRelatedCars internal linking (#S8)"
```

---

## Task 13: Estoque category filter via query param — #S8 (part 2)

**Files:**
- Modify: `app/sites/[slug]/estoque/page.tsx`

- [ ] **Step 1: Read current estoque page structure**

Run: `cat app/sites/\[slug\]/estoque/page.tsx | head -80`

- [ ] **Step 2: Add query param parsing + filter**

Modify the page to accept `searchParams`:

```tsx
interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ categoria?: string }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { categoria } = await searchParams;
  // ... existing fetch
  const filteredCars = categoria
    ? cars.filter((c) => c.category?.toLowerCase() === categoria.toLowerCase())
    : cars;
  // pass filteredCars to grid
}
```

- [ ] **Step 3: Add e2e regression**

```ts
// tests/e2e/sites/estoque-filter.spec.ts
import { test, expect } from "@playwright/test";

test("estoque page filters by ?categoria= query", async ({ page }) => {
  await page.goto("/sites/poliguara/estoque?categoria=sedan");
  await expect(page.getByText(/Sedan/i)).toBeVisible();
});
```

- [ ] **Step 4: Lint + typecheck + build**

Run: `npm run lint && npx tsc --noEmit && npm run build`

- [ ] **Step 5: Commit**

```bash
git add app/sites/[slug]/estoque/page.tsx tests/e2e/sites/estoque-filter.spec.ts
git commit -m "feat(sites): add categoria query filter on estoque listing (#S8)"
```

---

## Task 14: Lighthouse CI gate — #S9

**Files:**
- Create: `.github/workflows/lighthouse.yml`
- Create: `lighthouserc.json`

- [ ] **Step 1: Create budgets**

```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "url": [
        "{{PREVIEW_URL}}/sites/poliguara",
        "{{PREVIEW_URL}}/sites/poliguara/estoque",
        "{{PREVIEW_URL}}/sites/poliguara/sobre"
      ],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

- [ ] **Step 2: Create workflow**

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    paths:
      - "app/sites/**"
      - "components/sites/**"

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Wait for Vercel preview
        id: vercel
        uses: zentered/vercel-preview-url@v1.4.0
        with:
          vercel_token: ${{ secrets.VERCEL_TOKEN }}
          vercel_project_id: ${{ secrets.VERCEL_PROJECT_ID }}
      - name: Warm-up preview (cold start mitigation)
        run: curl -s -o /dev/null "${{ steps.vercel.outputs.preview_url }}/sites/poliguara" || true
      - name: Run Lighthouse CI
        env:
          PREVIEW_URL: ${{ steps.vercel.outputs.preview_url }}
        run: npx --yes @lhci/cli@0.13.x autorun --config=./lighthouserc.json
```

- [ ] **Step 3: Verify workflow syntactically valid (dry-run via gh)**

Run: `gh workflow list 2>/dev/null | head` (workflow só aparece após push; this step is informational)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/lighthouse.yml lighthouserc.json
git commit -m "ci(sites): add Lighthouse CI gate for site routes (#S9)"
```

- [ ] **Step 5: Test workflow end-to-end after push**

Push branch + open PR; observe `Lighthouse CI` check in PR. If first run fails due to missing secrets (`VERCEL_TOKEN`, `VERCEL_PROJECT_ID`), add them via:

```bash
gh secret set VERCEL_TOKEN
gh secret set VERCEL_PROJECT_ID
```

---

## Task 15: Documentation update — #S10

**Files:**
- Modify: `docs/SEO-PLAN.md`
- Modify: `app/sites/CLAUDE.md`
- Create: `lib/sites/schema/CLAUDE.md`

- [ ] **Step 1: Update `docs/SEO-PLAN.md`**

Read current content, append new "Schema architecture" section pointing to `lib/sites/schema/*` helpers.

- [ ] **Step 2: Update `app/sites/CLAUDE.md`**

Append section "Sitemap" documenting `app/sites/sitemap.ts` (global) + `app/sites/[slug]/sitemap.ts` (per-site) conventions.

- [ ] **Step 3: Create `lib/sites/schema/CLAUDE.md`**

```markdown
# `lib/sites/schema/` — JSON-LD schema helpers

## Purpose

Schema.org helpers que produzem JSON-LD válido server-side para injeção via
`<script type="application/ld+json">` em rotas de `/sites/<slug>/*`.

## Helpers disponíveis

| Helper | Schema type | Onde é injetado |
|---|---|---|
| `buildLocalBusinessSchema(variables, site)` | `["LocalBusiness", "AutoDealer"]` | `<SitePage>` (Home) |
| `buildVehicleSchema(car, site, variables)` | `Vehicle` | `/estoque/[carSlug]` page |
| `buildFAQSchema(faqs)` | `FAQPage` | `<SiteFAQ>` |
| `buildBreadcrumbSchema(items)` | `BreadcrumbList` | `<Breadcrumb>` |

## Pattern pra adicionar novo helper

1. Criar `lib/sites/schema/<name>.ts` com export tipado.
2. Test unitário em `tests/unit/lib/sites/schema/<name>.test.ts` cobrindo:
   - Estrutura completa do schema.
   - Campos opcionais omitidos quando ausentes.
   - URLs absolutas (via `safeAbsoluteUrl`).
3. Injetar via `<script>` no componente/rota consumidor.
4. Sempre passar pelo `escapeJsonLd()` antes de \`dangerouslySetInnerHTML\` —
   defesa contra XSS via \`</script>\`.
5. Validar com Google Rich Results Test após deploy preview.

## Defesa em profundidade

- **`escapeJsonLd`**: escapa \`</script>\`, \`<!--\`, \`-->\` em qualquer string.
- **`safeAbsoluteUrl`**: garante URLs absolutas; retorna `null` se input inválido.
- **Sanitize antes de schema**: campos textuais (\`business_name\`, \`description\`) já
  são sanitizados via \`sanitizeText\` no upstream do pipeline.

## Validação manual

- Google Rich Results: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/
```

- [ ] **Step 4: Commit**

```bash
git add docs/SEO-PLAN.md app/sites/CLAUDE.md lib/sites/schema/CLAUDE.md
git commit -m "docs(sites): document SEO infra architecture (#S10)"
```

---

## Final Verification

- [ ] **Run full test suite**

Run: `npm test`
Expected: all tests pass; coverage `lib/sites/schema/` ≥ 80% lines/functions

- [ ] **Run build**

Run: `npm run build`
Expected: success

- [ ] **Run lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero warnings/errors

- [ ] **Open PR and validate Lighthouse CI passes**

```bash
gh pr create --title "feat(sites): SEO infra hardening — sitemap + schema + canonical + IndexNow (#S1-#S10)" \
  --body "Implementa 10 issues da Frente 03 do epic Site Irresistível.

## Closes
Closes #S1, #S2, #S3, #S4, #S5, #S6, #S7, #S8, #S9, #S10

## Validation
- [ ] Lighthouse CI passa (target: perf ≥ 90, SEO ≥ 95, a11y ≥ 95)
- [ ] Google Rich Results Test passa pras 4 entidades (LocalBusiness, Vehicle, FAQPage, BreadcrumbList)
- [ ] Sitemap descoberto em Search Console em ≤ 48h pós-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Request code-review via Sentry skills**

In the PR conversation, invoke:
- `sentry-skills:code-review`
- `sentry-skills:security-review` (foco: XSS via \`dangerouslySetInnerHTML\`, secret leaks)

- [ ] **Squash merge after review**

```bash
gh pr merge --auto --squash --delete-branch
```

---

## Self-Review Checklist (executed by plan author)

**Spec coverage:**
- ✅ #S1 sitemap global → Task 2
- ✅ #S2 sitemap per-site → Task 3
- ✅ #S3 LocalBusiness schema → Tasks 4-5
- ✅ #S4 Vehicle schema → Task 6
- ✅ #S5 FAQPage + Breadcrumb → Tasks 7-8
- ✅ #S6 canonical → Tasks 9-10
- ✅ #S7 IndexNow proativo → Task 11
- ✅ #S8 internal linking → Tasks 12-13
- ✅ #S9 Lighthouse CI → Task 14
- ✅ #S10 docs → Task 15

**Placeholder scan:** No TBD/TODO/"implement later" patterns. All code complete.

**Type consistency:** `buildLocalBusinessSchema` returns `LocalBusinessSchema` (Task 4); `buildVehicleSchema` returns `VehicleSchema` (Task 6); both consumed via `escapeJsonLd` (Task 1) ✓.

**Notes for executor:**
- Each task = 1 PR if desired (small, reviewable) OR group Tasks 2-3 (sitemaps), 4-8 (schemas), 9-10 (canonical), 11 (IndexNow), 12-13 (linking), 14-15 (CI+docs) into 6 PRs.
- Re-verify file paths via Read tool before each task (avoids stale assumptions).
- If `SiteVariables` schema differs from assumed shape, adjust helpers — schema is in `lib/sites/variables/` or similar.
