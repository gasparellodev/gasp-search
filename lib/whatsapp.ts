/**
 * WhatsApp deep-link builder canônico (issue #200).
 *
 * **V1: PT-BR only.** i18n fica pra V2 (extrair templates pra
 * `Map<Locale, string>` quando segundo idioma chegar).
 *
 * 99% dos leads de PME semi-novos brasileiros passam por WhatsApp.
 * Este módulo elimina string concat de `wa.me/` ad-hoc no codebase
 * (anti-pattern: caso real visto na pesquisa de mercado — uma loja
 * tinha botão `javascript:void(0)` em produção). Toda construção de
 * link `https://wa.me/...?text=...` deve passar por `buildWhatsAppLink`.
 *
 * Público:
 *   - `buildWhatsAppLink(input)` — entry point.
 *   - `normalizePhoneBR(raw)` — helper exposto pra tests.
 *   - `formatPriceBR(n)`, `formatKmBR(n)` — formatadores BR.
 *   - `WhatsAppTemplateSchema`, `BuildWhatsAppLinkInputSchema` — Zod schemas.
 *   - `InvalidPhoneError` — erro tipado quando phone não normaliza.
 */

import { z } from "zod";

// ===========================================================================
// Erros tipados
// ===========================================================================

/**
 * Lança quando `normalizePhoneBR` recebe input que não pode ser
 * normalizado pra E.164 BR (12-13 dígitos com DDI 55).
 *
 * **PII redaction:** o `.message` exibe APENAS os últimos 4 dígitos
 * do raw input (`***9999`). Logs nunca contêm phone completo.
 */
export class InvalidPhoneError extends Error {
  readonly raw: string;
  readonly suffix: string;

  constructor(raw: string) {
    const digits = raw.replace(/\D/g, "");
    const suffix =
      digits.length >= 4 ? `***${digits.slice(-4)}` : "***<short>";
    super(`Invalid BR phone: ${suffix}`);
    this.name = "InvalidPhoneError";
    this.raw = raw;
    this.suffix = suffix;
  }
}

// ===========================================================================
// Phone normalization
// ===========================================================================

const VALID_BR_DDDS = new Set([
  // Sudeste
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35,
  37, 38,
  // Sul
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55,
  // Centro-Oeste/Norte
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  // Nordeste
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  // Norte
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Normaliza um phone BR (móvel ou fixo) para E.164 sem `+`:
 *   - Móvel (9º dígito): `5511999999999` (13 chars)
 *   - Fixo (sem 9º): `551133334444` (12 chars)
 *
 * Aceita formatos extremamente variados (ver `tests/unit/lib/whatsapp.test.ts`).
 * Throws `InvalidPhoneError` em qualquer entrada que não bata BR.
 */
export function normalizePhoneBR(raw: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new InvalidPhoneError(raw ?? "");
  }

  const digits = raw.replace(/\D/g, "");

  // Strip DDI 55 redundante (entrada já com 55) — mas só se total for 12/13 + 2.
  let local = digits;
  if (local.length === 14 || local.length === 15) {
    if (local.startsWith("55")) {
      local = local.slice(2);
    }
  } else if ((local.length === 12 || local.length === 13) && local.startsWith("55")) {
    // Já está com DDI — guard contra DDD começando com 55 (é DDD válido — RS).
    // Heurística: se sem o 55 inicial sobram 10/11 dígitos (DDD+phone), é DDI.
    const stripped = local.slice(2);
    if (stripped.length === 10 || stripped.length === 11) {
      local = stripped;
    }
  }

  // Após strip de DDI, esperamos DDD (2) + número (8 fixo OU 9 móvel) = 10 ou 11 dígitos.
  if (local.length !== 10 && local.length !== 11) {
    throw new InvalidPhoneError(raw);
  }

  const ddd = parseInt(local.slice(0, 2), 10);
  if (Number.isNaN(ddd) || !VALID_BR_DDDS.has(ddd)) {
    throw new InvalidPhoneError(raw);
  }

  // Móvel: terceiro dígito DEVE ser 9 (regra ANATEL). Fixo: 2/3/4/5.
  if (local.length === 11) {
    const ninthDigit = local[2];
    if (ninthDigit !== "9") {
      throw new InvalidPhoneError(raw);
    }
  }

  return `55${local}`;
}

// ===========================================================================
// Formatadores BR
// ===========================================================================

/**
 * Formata preço pt-BR sem símbolo monetário e sem decimais.
 * `formatPriceBR(49900)` → `"49.900"`.
 * Preços de carro nunca têm centavos no contexto comercial PME.
 */
export function formatPriceBR(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Formata quilometragem pt-BR.
 * `formatKmBR(45000)` → `"45.000"`.
 */
export function formatKmBR(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

// ===========================================================================
// Schemas Zod (input validation)
// ===========================================================================

export const WhatsAppTemplateSchema = z.enum([
  "general",
  "vehicle",
  "tradein",
  "financing",
]);
export type WhatsAppTemplate = z.infer<typeof WhatsAppTemplateSchema>;

/**
 * Componentes que originam o link — entra em `utm_content` para
 * rastreabilidade GA4. Enum fechado: novo componente exige PR no schema.
 */
export const WhatsAppComponentSchema = z.enum([
  "header",
  "footer",
  "contact-section",
  "car-detail",
  "stock-card",
  "home-cta",
  "advertise-section",
  "floating-cta",
  "site-form",
  "other",
]);
export type WhatsAppComponent = z.infer<typeof WhatsAppComponentSchema>;

const VehicleContextSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z
    .number()
    .int()
    .min(1990)
    .max(new Date().getFullYear() + 1),
  price: z.number().positive().nullable(),
  carSlug: z.string().regex(/^[a-z0-9-]+$/),
});

const TradeInContextSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z
    .number()
    .int()
    .min(1980)
    .max(new Date().getFullYear() + 1),
  km: z.number().int().min(0).nullable().optional(),
});

const FinancingContextSchema = z.object({
  carPrice: z.number().positive(),
  downPaymentPct: z.number().int().min(0).max(100),
  months: z.number().int().min(1).max(120),
  carBrand: z.string().min(1).optional(),
  carModel: z.string().min(1).optional(),
});

const BaseInputSchema = z.object({
  phone: z.string().min(1),
  businessName: z.string().min(1).max(80),
  siteSlug: z.string().regex(/^[a-z0-9-]+$/),
  component: WhatsAppComponentSchema,
});

export const BuildWhatsAppLinkInputSchema = z.discriminatedUnion("template", [
  BaseInputSchema.extend({ template: z.literal("general") }),
  BaseInputSchema.extend({
    template: z.literal("vehicle"),
    vehicle: VehicleContextSchema,
  }),
  BaseInputSchema.extend({
    template: z.literal("tradein"),
    trade: TradeInContextSchema,
  }),
  BaseInputSchema.extend({
    template: z.literal("financing"),
    finance: FinancingContextSchema,
  }),
]);
export type BuildWhatsAppLinkInput = z.infer<typeof BuildWhatsAppLinkInputSchema>;

// ===========================================================================
// Builder
// ===========================================================================

/**
 * Renderiza template em string PT-BR pronta pra `encodeURIComponent`.
 * Strings literais EXATAS — não inventar variações (alinhar com PO refinement
 * #200 §2).
 */
function renderTemplate(input: BuildWhatsAppLinkInput): string {
  switch (input.template) {
    case "general":
      return `Olá! Vi o site da ${input.businessName} e gostaria de mais informações.`;

    case "vehicle": {
      const { brand, model, year, price } = input.vehicle;
      if (price !== null) {
        return `Olá! Vi o ${brand} ${model} ${year} (R$ ${formatPriceBR(price)}) no site da ${input.businessName} e gostaria de mais informações. Ainda está disponível?`;
      }
      return `Olá! Vi o ${brand} ${model} ${year} no site da ${input.businessName} e gostaria de mais informações. Ainda está disponível?`;
    }

    case "tradein": {
      const { brand, model, year, km } = input.trade;
      if (km != null) {
        return `Olá! Tenho um ${brand} ${model} ${year} com ${formatKmBR(km)} km para dar de entrada na ${input.businessName}. Vocês avaliam?`;
      }
      return `Olá! Tenho um ${brand} ${model} ${year} para dar de entrada na ${input.businessName}. Vocês avaliam?`;
    }

    case "financing": {
      const { carBrand, carModel, carPrice, downPaymentPct, months } =
        input.finance;
      if (carBrand && carModel) {
        return `Olá! Simulei o ${carBrand} ${carModel} no site da ${input.businessName}: entrada de ${downPaymentPct}% em ${months}x. Pode me enviar uma proposta?`;
      }
      return `Olá! Simulei um financiamento de R$ ${formatPriceBR(carPrice)} no site da ${input.businessName}: entrada de ${downPaymentPct}% em ${months}x. Pode me enviar uma proposta?`;
    }
  }
}

/**
 * Monta deep-link `https://wa.me/<phone>?text=<encoded>&utm_*=...`.
 *
 * Pipeline:
 *   1. `BuildWhatsAppLinkInputSchema.parse(input)` (Zod, throw `ZodError`).
 *   2. `normalizePhoneBR(input.phone)` (throw `InvalidPhoneError`).
 *   3. Render texto via template.
 *   4. Compõe URL com query string em ordem determinística.
 *
 * **Ordem dos params (determinística — importante pra snapshot tests):**
 * `text` → `utm_source` → `utm_medium` → `utm_campaign` → `utm_content` → `utm_term`.
 *
 * @throws {ZodError} input não passa no schema.
 * @throws {InvalidPhoneError} phone não normaliza pra BR válido.
 */
export function buildWhatsAppLink(input: BuildWhatsAppLinkInput): string {
  const parsed = BuildWhatsAppLinkInputSchema.parse(input);

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhoneBR(parsed.phone);
  } catch (err) {
    if (err instanceof InvalidPhoneError) {
      console.warn("[whatsapp] invalid phone in buildWhatsAppLink", {
        component: parsed.component,
        template: parsed.template,
        phoneSuffix: err.suffix,
      });
    }
    throw err;
  }

  const text = renderTemplate(parsed);
  const params: ReadonlyArray<readonly [string, string]> = [
    ["text", text],
    ["utm_source", "site"],
    ["utm_medium", "whatsapp"],
    ["utm_campaign", parsed.template],
    ["utm_content", parsed.component],
    ["utm_term", parsed.siteSlug],
  ];

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return `https://wa.me/${normalizedPhone}?${query}`;
}
