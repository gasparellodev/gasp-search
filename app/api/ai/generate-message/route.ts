import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import {
  generateMessage,
  type LeadForMessage,
} from "@/lib/ai/anthropic";
import { apiErrorResponse } from "@/lib/api/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateMessageSchema } from "@/lib/validators/ai";

const RATE_LIMIT_MS = 1_000;
const lastRequestByUser = new Map<string, number>();

const LEAD_FOR_MESSAGE_SELECT = [
  "name",
  "source",
  "category",
  "city",
  "state",
  "country",
  "phone",
  "email",
  "website",
  "instagram_handle",
  "whatsapp",
  "has_website",
  "rating",
  "reviews_count",
  "followers_count",
  "stage",
  "score",
  "notes",
].join(",");

function validationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const last = lastRequestByUser.get(userId);
  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    return false;
  }
  lastRequestByUser.set(userId, now);
  return true;
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

  const parsed = generateMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um segundo." },
      { status: 429 },
    );
  }

  try {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(LEAD_FOR_MESSAGE_SELECT)
      .eq("id", parsed.data.leadId)
      .maybeSingle();

    if (leadError) {
      throw new Error(`Falha ao carregar lead: ${leadError.message}`);
    }
    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    const content = await generateMessage(lead as unknown as LeadForMessage, {
      channel: parsed.data.channel,
      tone: parsed.data.tone,
      goal: parsed.data.goal,
    });

    const { data: message, error: messageError } = await supabase
      .from("lead_messages")
      .insert({
        lead_id: parsed.data.leadId,
        user_id: user.id,
        channel: parsed.data.channel,
        tone: parsed.data.tone,
        content,
      })
      .select("id, content")
      .single();

    if (messageError || !message) {
      throw new Error(
        `Falha ao persistir mensagem: ${messageError?.message ?? "desconhecido"}`,
      );
    }

    return NextResponse.json({
      content: message.content,
      messageId: message.id,
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/ai/generate-message", userId: user.id },
      "Falha ao gerar mensagem. Tente novamente.",
    );
  }
}
