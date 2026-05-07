import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16: `proxy.ts` substitui `middleware.ts` na raiz. A função exportada
// pode chamar-se `proxy` (preferido) ou ser um default export.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Roda em quase tudo, exceto:
  // - api/* (handlers próprios, validam sessão por request)
  // - _next/static, _next/image, favicon, assets
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
