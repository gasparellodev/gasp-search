import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { createEvolutionClient, EvolutionApiError } from "@/lib/evolution/client";
import { createServerSupabase } from "@/lib/supabase/server";

// Slug estável e curto. evita expor o UUID inteiro do user no Evolution.
function instanceSlug(userId: string): string {
  return `user_${userId.slice(0, 8)}`;
}

type InstanceStatusResponse = {
  status: "disconnected" | "qr_pending" | "connecting" | "connected" | "error";
  phoneNumber: string | null;
  lastSeenAt: string | null;
};

const DEFAULT_DISCONNECTED: InstanceStatusResponse = {
  status: "disconnected",
  phoneNumber: null,
  lastSeenAt: null,
};

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("status, phone_number, last_seen_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json(DEFAULT_DISCONNECTED);

    const payload: InstanceStatusResponse = {
      status: data.status,
      phoneNumber: data.phone_number,
      lastSeenAt: data.last_seen_at,
    };
    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/whatsapp/instance", userId: user.id },
      "Falha ao consultar instância WhatsApp.",
    );
  }
}

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const evoInstance = instanceSlug(user.id);
  try {
    const evolution = createEvolutionClient();
    const created = await evolution.createInstance(evoInstance);

    // Status inicial após createInstance: ainda não pareou → qr_pending.
    // Se o Evolution já voltar 'connected' (improvável neste fluxo, mas
    // possível se reusarmos uma instância), respeitamos.
    const initialStatus =
      created.status === "connected" ? "connected" : "qr_pending";

    const { error } = await supabase
      .from("whatsapp_instances")
      .upsert(
        {
          user_id: user.id,
          evo_instance: created.instanceName,
          status: initialStatus,
          qr_code: created.qrcode,
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;

    return NextResponse.json(
      {
        status: initialStatus,
        evoInstance: created.instanceName,
        qrcode: created.qrcode,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof EvolutionApiError && error.status === 401) {
      return NextResponse.json(
        { error: "Falha ao autenticar com Evolution. Verifique a EVOLUTION_API_KEY." },
        { status: 502 },
      );
    }
    return apiErrorResponse(
      error,
      { route: "POST /api/whatsapp/instance", userId: user.id },
      "Falha ao criar instância WhatsApp.",
    );
  }
}

export async function DELETE() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const { data: existing } = await supabase
      .from("whatsapp_instances")
      .select("evo_instance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.evo_instance) {
      try {
        const evolution = createEvolutionClient();
        await evolution.deleteInstance(existing.evo_instance);
      } catch (cause) {
        // 404 do Evolution é ok — instância já não existe lá. Outros erros
        // logamos mas seguimos pra deletar a row local (UI quer ficar limpa).
        if (
          !(cause instanceof EvolutionApiError) ||
          cause.status !== 404
        ) {
          console.warn(
            JSON.stringify({
              level: "warn",
              route: "DELETE /api/whatsapp/instance",
              userId: user.id,
              message: cause instanceof Error ? cause.message : "evolution delete failed",
            }),
          );
        }
      }
    }

    const { error } = await supabase
      .from("whatsapp_instances")
      .delete()
      .eq("user_id", user.id);
    if (error) throw error;

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "DELETE /api/whatsapp/instance", userId: user.id },
      "Falha ao desconectar instância WhatsApp.",
    );
  }
}
