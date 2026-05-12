import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * OAuth callback handler.
 *
 * Recebe `?code=...` do Supabase OAuth (Google), troca por sessão e
 * grava cookies. Em sucesso, redireciona para `redirectTo` (default
 * `/dashboard`). Em erro, volta para `/login?error=...`.
 *
 * Aplica também ao confirmation de e-mail (signUp emailRedirectTo aponta
 * para esta rota com `?token_hash=...&type=...`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // #138b — guard contra open redirect via `?redirectTo=`.
  //
  // Sem isso, valores como `//evil.com`, `/\evil.com` ou `https://evil.com`
  // são interpretados pelo browser como cross-origin (protocol-relative ou
  // absoluto), permitindo que um atacante phishing roube a sessão recém-
  // emitida ao redirecionar o usuário pra um clone do app.
  //
  // Aceitamos APENAS path relativo iniciado por `/` e seguido de char
  // diferente de `/` ou `\` (que browsers podem normalizar para `//`).
  const requestedRedirect = searchParams.get("redirectTo");
  const isSafeRedirect =
    typeof requestedRedirect === "string" &&
    requestedRedirect.length > 1 &&
    requestedRedirect.startsWith("/") &&
    !requestedRedirect.startsWith("//") &&
    !requestedRedirect.startsWith("/\\");
  const redirectTo = isSafeRedirect ? requestedRedirect : "/dashboard";

  // Ambiente Next 16: response será mutada pelo cookie handler.
  let response = NextResponse.redirect(`${origin}${redirectTo}`);

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
          response = NextResponse.redirect(`${origin}${redirectTo}`);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // OAuth code exchange (Google).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = new URL("/login", origin);
      url.searchParams.set("error", error.message);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Email confirmation (signUp).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "email" | "recovery" | "invite" | "email_change",
      token_hash: tokenHash,
    });
    if (error) {
      const url = new URL("/login", origin);
      url.searchParams.set("error", error.message);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Sem code nem token — provavelmente acessado direto. Redireciona para login.
  const url = new URL("/login", origin);
  url.searchParams.set("error", "Callback inválido — faça login novamente.");
  return NextResponse.redirect(url);
}
