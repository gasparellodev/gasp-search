import "server-only";
import { z } from "zod";

const serverEnvSchema = z
  .object({
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
    // OpenAI (Phase 7 #216 — visual identity generation)
    // Snapshot pinado em `OPENAI_IMAGE_MODEL` per spike: gpt-image-2-2026-04-21.
    // Concurrency default 2 (Tier-1-safe, 5 IPM limit).
    // BRL_RATE conversão USD→BRL hardcoded V1 (taxa 5.0 — não realtime).
    //
    // **`OPENAI_API_KEY` é opcional no schema** — Vercel preview e CI builds
    // sem o secret precisam bootar normalmente. Validação real fica lazy
    // em `lib/openai/image-client.ts:getOpenAIClient()`: throws eloquente
    // só quando algum code path tenta gerar imagem. Code paths que não
    // tocam OpenAI (login, dashboard, leads, etc.) seguem funcionando.
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_IMAGE_MODEL: z.string().min(1).default("gpt-image-2-2026-04-21"),
    OPENAI_IMAGE_FALLBACK_MODEL: z.string().min(1).default("gpt-image-1-mini"),
    OPENAI_IMAGE_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .max(10)
      .default(2),
    BRL_RATE: z.coerce.number().positive().default(5.0),
    INDEXNOW_KEY: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .string()
        .trim()
        .min(8, "INDEXNOW_KEY deve ter pelo menos 8 caracteres")
        .regex(/^[A-Za-z0-9_-]+$/, "INDEXNOW_KEY deve ser alfanumérica")
        .optional(),
    ),
    EVOLUTION_API_URL: z
      .url("EVOLUTION_API_URL deve ser uma URL válida")
      .refine((u) => /^https?:\/\//.test(u), {
        message: "EVOLUTION_API_URL precisa usar http(s)",
      })
      .default("http://localhost:8080"),
    EVOLUTION_API_KEY: z.string().min(1).optional(),
    EVOLUTION_WEBHOOK_SECRET: z.string().optional(),
    NEXT_PUBLIC_WHATSAPP_ENABLED: z.enum(["0", "1"]).default("0"),
    // Phase 6 / #134 — rate-limit por usuário em POST /api/campaigns.
    // Hard cap de campanhas criadas por hora (window 1h via `created_at`).
    // Server-only: nunca expor no bundle do cliente. Default 5/h é
    // conservador o suficiente para uso humano e protege budget Anthropic
    // + quotas WhatsApp contra flooding acidental ou malicioso.
    MAX_CAMPAIGNS_PER_HOUR: z.coerce.number().int().positive().default(5),
    // Phase 6 / #122 — BullMQ + Redis. Default casa com o docker-compose em
    // `docker/redis/` (host 6380 → container 6379). Aceita URL com auth
    // (`redis://:password@host:port`) e TLS (`rediss://`) para V2 prod
    // (Upstash / Vercel KV / Redis Cloud). Validador refine bloqueia
    // outros schemes acidentais.
    REDIS_URL: z
      .url("REDIS_URL deve ser uma URL válida")
      .refine((u) => /^rediss?:\/\//.test(u), {
        message: "REDIS_URL precisa usar redis(s)://",
      })
      .default("redis://localhost:6380"),
    // Test-only seed (Phase 7 #166). Apenas relevante em dev/test.
    // Em produção a rota `/api/__test__/seed-lead-site` retorna 404
    // independentemente desses valores.
    TEST_SEED_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
    TEST_SEED_USER_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
  })
  .superRefine((data, ctx) => {
    if (data.NEXT_PUBLIC_WHATSAPP_ENABLED !== "1") return;
    if (!data.EVOLUTION_API_KEY || data.EVOLUTION_API_KEY.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["EVOLUTION_API_KEY"],
        message:
          "EVOLUTION_API_KEY é obrigatório quando NEXT_PUBLIC_WHATSAPP_ENABLED=1",
      });
    }
    if (
      !data.EVOLUTION_WEBHOOK_SECRET ||
      data.EVOLUTION_WEBHOOK_SECRET.length < 16
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["EVOLUTION_WEBHOOK_SECRET"],
        message:
          "EVOLUTION_WEBHOOK_SECRET deve ter pelo menos 16 caracteres quando NEXT_PUBLIC_WHATSAPP_ENABLED=1",
      });
    }
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
