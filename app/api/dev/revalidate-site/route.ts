import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * Cache-bust pra um site público específico.
 *
 * - **Dev**: sempre permitido (sem token).
 * - **Prod**: exige token em `?token=` ou header `x-revalidate-token`.
 *   Tokens aceitos (a primeira env presente):
 *     1. `REVALIDATE_TOKEN` — token dedicado (recomendado long-term).
 *     2. `SUPABASE_SERVICE_ROLE_KEY` — fallback pragmático: já existe em
 *        prod, dispensa nova env. Comparação `timingSafeEqual` evita
 *        timing attacks.
 *
 *   Sem nenhuma env válida E token bater, rota retorna 404.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const queryToken = url.searchParams.get("token");
  const headerToken = request.headers.get("x-revalidate-token");
  const provided = queryToken ?? headerToken;

  if (process.env.NODE_ENV === "production") {
    const acceptedTokens = [
      process.env.REVALIDATE_TOKEN,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ].filter((v): v is string => typeof v === "string" && v.length > 0);

    const safeEqual = (a: string, b: string): boolean => {
      if (a.length !== b.length) return false;
      let diff = 0;
      for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
      }
      return diff === 0;
    };

    const valid =
      typeof provided === "string" &&
      provided.length > 0 &&
      acceptedTokens.some((t) => safeEqual(t, provided));

    if (!valid) {
      return new NextResponse("not_found", { status: 404 });
    }
  }

  if (!slug) {
    return NextResponse.json(
      { ok: false, reason: "missing_slug" },
      { status: 400 },
    );
  }
  revalidateTag(`site:${slug}`, "default");
  revalidatePath(`/sites/${slug}`);
  return NextResponse.json({ ok: true, invalidated: `site:${slug}` });
}
