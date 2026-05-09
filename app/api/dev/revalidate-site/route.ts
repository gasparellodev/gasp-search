import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("not_found", { status: 404 });
  }
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ ok: false, reason: "missing_slug" }, { status: 400 });
  }
  revalidateTag(`site:${slug}`, "default");
  revalidatePath(`/sites/${slug}`);
  return NextResponse.json({ ok: true, invalidated: `site:${slug}` });
}
