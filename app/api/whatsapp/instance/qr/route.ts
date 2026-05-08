import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { createEvolutionClient, EvolutionApiError } from "@/lib/evolution/client";
import { createServerSupabase } from "@/lib/supabase/server";

// Endpoint chamado pelo frontend em polling (a cada ~2s) enquanto a instância
// está em qr_pending. Devolve o QR mais recente do Evolution e atualiza
// a row de whatsapp_instances. Sempre Cache-Control no-store.
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { data: existing } = await supabase
      .from("whatsapp_instances")
      .select("evo_instance, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { qrcode: null, status: "disconnected" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const evolution = createEvolutionClient();
    let qr;
    try {
      qr = await evolution.getQRCode(existing.evo_instance);
    } catch (cause) {
      // Estado órfão: row no DB existe mas instância sumiu do Evolution
      // (container resetado, instância apagada por outro path, etc.). Em
      // vez de loopar 502, faz self-heal: zera a row pra UI voltar pro
      // estado "disconnected" e o user clica Conectar de novo.
      if (cause instanceof EvolutionApiError && cause.status === 404) {
        await supabase
          .from("whatsapp_instances")
          .delete()
          .eq("user_id", user.id);
        return NextResponse.json(
          { qrcode: null, status: "disconnected" },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      throw cause;
    }
    // Se o Evolution não retornar QR (já pareado), a UI tira a tela de QR
    // e aguarda webhook 'connection.update' marcar 'connected'.
    if (qr.qrcode) {
      await supabase
        .from("whatsapp_instances")
        .update({ qr_code: qr.qrcode })
        .eq("user_id", user.id);
    }

    return NextResponse.json(
      {
        qrcode: qr.qrcode,
        pairingCode: qr.pairingCode,
        status: existing.status,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/whatsapp/instance/qr", userId: user.id },
      "Falha ao consultar QR Code.",
    );
  }
}
