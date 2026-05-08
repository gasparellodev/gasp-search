import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/evolution/rate-limit";
import { sendWhatsAppMessage } from "@/lib/evolution/send";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendWhatsappMessageBodySchema } from "@/lib/validators/whatsapp";

function validationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

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

  const parsed = sendWhatsappMessageBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  const rate = checkRateLimit(user.id);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Aguarde antes de enviar outra mensagem." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    const result = await sendWhatsAppMessage({
      supabase,
      userId: user.id,
      leadId: parsed.data.leadId,
      content: parsed.data.content,
    });

    if (result.ok) {
      return NextResponse.json(
        {
          messageId: result.messageId,
          whatsappMsgId: result.whatsappMsgId,
          status: "sent",
        },
        { status: 201 },
      );
    }

    switch (result.reason) {
      case "instance_disconnected":
        return NextResponse.json(
          { error: "Conecte o WhatsApp em Configurações antes de enviar." },
          { status: 409 },
        );
      case "lead_not_found":
        return NextResponse.json(
          { error: "Lead não encontrado." },
          { status: 404 },
        );
      case "lead_missing_phone":
        return NextResponse.json(
          { error: "Lead sem telefone válido." },
          { status: 422 },
        );
      case "evolution_error":
      default:
        return NextResponse.json(
          {
            error: "Falha ao enviar mensagem.",
            messageId: result.messageId,
          },
          { status: 502 },
        );
    }
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/whatsapp/send", userId: user.id },
      "Falha ao enviar mensagem.",
    );
  }
}
