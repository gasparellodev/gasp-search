import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
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
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY ausente"),
  APIFY_TOKEN: z.string().min(1, "APIFY_TOKEN ausente"),
  APIFY_GOOGLE_MAPS_ACTOR_ID: z
    .string()
    .min(1, "APIFY_GOOGLE_MAPS_ACTOR_ID ausente"),
  APIFY_INSTAGRAM_ACTOR_ID: z
    .string()
    .min(1, "APIFY_INSTAGRAM_ACTOR_ID ausente"),
  APIFY_WEBSITE_CONTACT_ACTOR_ID: z
    .string()
    .min(1, "APIFY_WEBSITE_CONTACT_ACTOR_ID ausente"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY ausente"),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
  AUTO_ENRICH_AFTER_GMAPS: z
    .enum(["1", "0", "true", "false"])
    .default("1")
    .transform((value) => value === "1" || value === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function load(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<env>"}: ${i.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return parsed.data;
}

export const env: ServerEnv = load();
