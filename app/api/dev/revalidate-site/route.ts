import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * Cache-bust pra um site público específico.
 *
 * - **Dev**: sempre permitido (sem token).
 * - **Prod**: exige `?token=$REVALIDATE_TOKEN` matching `REVALIDATE_TOKEN` env.
 *   Sem env var setada em prod, rota retorna 404 (segurança first).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const token = url.searchParams.get("token");

  if (process.env.NODE_ENV === "production") {
    const expected = process.env.REVALIDATE_TOKEN;
    if (!expected || !token || token !== expected) {
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
