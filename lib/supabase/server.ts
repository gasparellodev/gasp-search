import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * Supabase client para Server Components e Server Actions.
 *
 * Usa cookies do request via `next/headers`. Cada chamada cria nova
 * instância — não cachear em variável de módulo (cookies são por-request).
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` chamado a partir de um Server Component (read-only).
            // Pode ser ignorado se o middleware refresh-a a sessão; vai falhar
            // se for o único lugar onde a sessão é refrescada.
          }
        },
      },
    },
  );
}
