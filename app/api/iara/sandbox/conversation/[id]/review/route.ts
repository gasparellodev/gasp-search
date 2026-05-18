import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

/**
 * PATCH /api/iara/sandbox/conversation/[id]/review
 * — registra veredito do founder sobre uma conversa simulada.
 * — body: { approvalStatus, approvalNotes? }
 *
 * Owners only: o user_id da conversa precisa bater com o session.
 * `reviewed_by` é gravado como user.id (em multi-user vai diferenciar
 * de `user_id`/owner). `reviewed_at` é stamp do servidor.
 */

const bodySchema = z.object({
  approvalStatus: z.enum(["pending", "approved", "rejected"]),
  approvalNotes: z.string().trim().max(2000).optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      {
        error: "Body inválido",
        issues: [{ path: "", message: "JSON inválido" }],
      },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Body inválido",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { approvalStatus, approvalNotes } = parsed.data;

  try {
    const service = createServiceSupabase();

    // Ownership check primeiro: precisamos garantir que a conversa
    // existe e é do user antes de aplicar UPDATE com service-role.
    const existing = await service
      .from("whatsapp_conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing.error) {
      throw new Error(`Falha ao validar conversa: ${existing.error.message}`);
    }
    if (!existing.data) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 },
      );
    }

    const nowIso = new Date().toISOString();
    const updates =
      approvalStatus === "pending"
        ? {
            approval_status: "pending" as const,
            approval_notes: approvalNotes ?? null,
            reviewed_at: null as string | null,
            reviewed_by: null as string | null,
          }
        : {
            approval_status: approvalStatus,
            approval_notes: approvalNotes ?? null,
            reviewed_at: nowIso,
            reviewed_by: user.id,
          };

    const { error } = await service
      .from("whatsapp_conversations")
      .update(updates)
      .eq("id", conversationId)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`Falha ao gravar veredito: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      conversationId,
      approvalStatus,
      reviewedAt: updates.reviewed_at,
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      {
        route: "PATCH /api/iara/sandbox/conversation/[id]/review",
        userId: user.id,
      },
      "Falha ao registrar veredito. Tente novamente.",
    );
  }
}
