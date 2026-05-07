import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// Rotas que NUNCA exigem sessão (auth flow + OAuth callback).
const PUBLIC_PATHS = ["/login", "/callback", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refresh do cookie da sessão Supabase + auth gate.
 *
 * Se o usuário não estiver autenticado e tentar acessar rota protegida,
 * redireciona para /login preservando o caminho de destino em ?redirectTo.
 * Se o usuário JÁ estiver logado e visitar /, redireciona para /dashboard.
 *
 * Importante: a NextResponse retornada precisa preservar os Set-Cookie
 * que o Supabase escreveu via `set/remove` — caso contrário a sessão
 * nunca é renovada. Por isso passamos `response` como buffer mutável.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // Logado em / → manda para /dashboard.
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Sem sessão em rota protegida → redireciona para /login.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("redirectTo", `${pathname}${search}`);
    }
    return NextResponse.redirect(url);
  }

  return response;
}
