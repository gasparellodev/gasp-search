import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .url("NEXT_PUBLIC_APP_URL deve ser uma URL válida")
    .refine((u) => /^https?:\/\//.test(u), {
      message: "NEXT_PUBLIC_APP_URL precisa usar http(s)",
    }),
  NEXT_PUBLIC_SUPABASE_URL: z
    .url("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida")
    .refine((u) => /^https?:\/\//.test(u), {
      message: "NEXT_PUBLIC_SUPABASE_URL precisa usar http(s)",
    }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente"),
  NEXT_PUBLIC_WHATSAPP_ENABLED: z.enum(["0", "1"]).default("0"),
  // Site Generator Phase 7 / Sprint 4 / #H3 — issue #223.
  // Feature flag pra ligar persistência do `<HomeContactFormQuick>` em
  // `lead_form_submissions`. Default `"0"` (off) — deploy gradual.
  NEXT_PUBLIC_SITE_FORMS_ENABLED: z.enum(["0", "1"]).default("0"),
  // Phase 7 #233 — GA4 (consent-gated no cliente) + GSC verification meta.
  NEXT_PUBLIC_GA4_ID: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).optional(),
  ),
  NEXT_PUBLIC_GSC_VERIFICATION: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

// Next.js inlinea `process.env.NEXT_PUBLIC_*` em build time, por isso este
// arquivo é seguro para Client Components. Acesso direto às chaves (não via
// destructuring dinâmico) para que o inlining funcione.
function load(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WHATSAPP_ENABLED: process.env.NEXT_PUBLIC_WHATSAPP_ENABLED,
    NEXT_PUBLIC_SITE_FORMS_ENABLED: process.env.NEXT_PUBLIC_SITE_FORMS_ENABLED,
    NEXT_PUBLIC_GA4_ID: process.env.NEXT_PUBLIC_GA4_ID,
    NEXT_PUBLIC_GSC_VERIFICATION: process.env.NEXT_PUBLIC_GSC_VERIFICATION,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<env>"}: ${i.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente públicas inválidas:\n${issues}`);
  }
  return parsed.data;
}

export const publicEnv: PublicEnv = load();
