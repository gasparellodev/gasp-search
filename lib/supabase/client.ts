"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env-public";

/**
 * Supabase client para Client Components.
 *
 * Cria nova instância a cada chamada — barato, e garante que estado
 * de sessão fica isolado. Para hot reloads, evite cachear em useState
 * sem chave estável.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
