import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

// ----------------------------------------------------------------------------
// Supabase client com service_role (BYPASSA RLS).
// ----------------------------------------------------------------------------
// Use APENAS em handlers públicos onde não há `auth.uid()`:
//   - Webhook do Evolution (`/api/whatsapp/webhook`) — não há cookie, mas
//     a autenticidade é garantida pelo HMAC.
//
// O caller é responsável por:
//   1. Verificar autenticidade do request (HMAC, secret, etc.).
//   2. Resolver `user_id` corretamente antes de qualquer escrita
//      (geralmente via lookup em `whatsapp_instances.evo_instance`).
//   3. Aplicar `eq('user_id', resolvedUserId)` em toda escrita pra simular
//      o isolamento que a RLS faria.
// ----------------------------------------------------------------------------

export function createServiceSupabase(): SupabaseClient<Database> {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
