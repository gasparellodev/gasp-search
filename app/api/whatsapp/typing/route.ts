import { NextResponse } from "next/server";
import { z, type ZodError } from "zod";

import { apiErrorResponse } from "@/lib/api/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { setLeadPresence } from "@/lib/whatsapp/presence";

const typingBodySchema = z
  .object({
    leadId: z.string().uuid("leadId precisa ser um UUID válido"),
    presence: z.enum(["typing", "paused"]),
  })
  .strict();

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

  const parsed = typingBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", parsed.data.leadId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado." },
        { status: 404 },
      );
    }

    await setLeadPresence({
      userId: user.id,
      leadId: parsed.data.leadId,
      presence: parsed.data.presence,
    });

    return NextResponse.json(
      { ok: true, presence: parsed.data.presence },
      { status: 202 },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/whatsapp/typing", userId: user.id },
      "Falha ao atualizar digitação.",
    );
  }
}
