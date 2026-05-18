import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/ai/anthropic";
import {
  IARA_TOOLS,
  getIaraSystemPrompt,
} from "@/lib/ai/iara/system-prompt";
import {
  IARA_TOOL_HANDLERS,
  isIaraToolName,
} from "@/lib/ai/iara/tools";
import {
  appendMessage,
  getOrCreateConversation,
  loadHistory,
} from "@/lib/ai/iara/memory";
import { apiErrorResponse } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  leadId: z.string().uuid("leadId precisa ser um UUID válido"),
  userMessage: z
    .string()
    .trim()
    .min(1, "userMessage não pode ser vazia")
    .max(2000, "userMessage muito longa (max 2000)"),
  founderName: z.string().trim().min(1).max(40).default("Vinicius"),
  founderDescricao: z.string().trim().min(1).max(400).optional(),
});

// Limite duro de segurança contra loops infinitos de tool_use ↔ tool_result.
// Em situações normais a Iara faz no máximo 1-2 ciclos: consultar lead +
// (opcional) escalar/agendar. 3 dá folga sem virar bomba de custo.
const MAX_TOOL_ITERATIONS = 3;

// Anthropic content block (simplificado pro shape que processamos aqui).
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

type ConversationMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

function extractFinalText(content: ContentBlock[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function buildHistoryMessages(
  entries: Awaited<ReturnType<typeof loadHistory>>,
): ConversationMessage[] {
  // Para o backbone, mensagens persistidas em `iara_messages` são
  // textuais (turno LLM como string). Tool_use / tool_result blocks
  // só precisam estar no array dentro de UMA chamada à API — Anthropic
  // não exige replay deles na próxima requisição (o snapshot textual
  // resume o contexto suficientemente).
  return entries.map((entry) => ({
    role: entry.role,
    content: entry.content,
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
      { error: "Body inválido", issues: [{ path: "", message: "JSON inválido" }] },
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

  const { leadId, userMessage, founderName, founderDescricao } = parsed.data;

  try {
    // 1. Garantia: usuário owna o lead. RLS já protege em prod, mas
    // como o memory layer usa service-role, validamos aqui antes.
    const leadCheck = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (leadCheck.error) {
      throw new Error(`Falha ao validar lead: ${leadCheck.error.message}`);
    }
    if (!leadCheck.data) {
      return NextResponse.json(
        { error: "Lead não encontrado" },
        { status: 404 },
      );
    }

    // 2. Conversa.
    const conversation = await getOrCreateConversation({
      leadId,
      userId: user.id,
      isSandbox: true,
    });

    // 3. Histórico anterior (pode estar vazio).
    const history = await loadHistory(conversation.id);

    // 4. Persiste a mensagem do usuário (antes de chamar IA — se LLM
    //    falhar, a fala do cliente fica gravada de qualquer forma).
    await appendMessage({
      conversationId: conversation.id,
      role: "user",
      content: userMessage,
    });

    // 5. Monta o array `messages` que vai pro Anthropic.
    const messages: ConversationMessage[] = [
      ...buildHistoryMessages(history),
      { role: "user", content: userMessage },
    ];

    const systemPrompt = getIaraSystemPrompt({
      founder_name: founderName,
      founder_descricao: founderDescricao,
    });

    const collectedToolCalls: Array<{
      tool: string;
      input: unknown;
      output: unknown;
    }> = [];
    let lastHandoff: { priority: string; motivo: string } | null = null;

    // 6. Loop de tool-use. Cada iteração chama Anthropic; se a resposta
    //    tiver tool_use blocks, executamos os handlers e adicionamos
    //    tool_result na próxima request.
    let iterations = 0;
    let finalText = "";

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations += 1;

      const response = (await anthropic.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools: IARA_TOOLS as unknown as Anthropic.Tool[],
        messages: messages as unknown as Anthropic.MessageParam[],
      })) as { content: ContentBlock[]; stop_reason?: string | null };

      const blocks = Array.isArray(response.content) ? response.content : [];
      const toolUses = blocks.filter(
        (b): b is { type: "tool_use"; id: string; name: string; input: unknown } =>
          b.type === "tool_use",
      );

      // Anexa o turno do assistant (com tool_use blocks intactos) ao
      // contexto, antes de gerar os tool_results.
      messages.push({
        role: "assistant",
        content: blocks,
      });

      if (toolUses.length === 0) {
        finalText = extractFinalText(blocks);
        break;
      }

      // Executa cada tool e prepara tool_result blocks.
      const toolResults: ContentBlock[] = [];
      for (const toolUse of toolUses) {
        if (!isIaraToolName(toolUse.name)) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              error: `Tool desconhecida: ${toolUse.name}`,
            }),
            is_error: true,
          });
          continue;
        }

        try {
          const handler = IARA_TOOL_HANDLERS[toolUse.name];
          const output = await handler(toolUse.input, {
            userId: user.id,
            conversationId: conversation.id,
            leadId,
          });

          collectedToolCalls.push({
            tool: toolUse.name,
            input: toolUse.input,
            output,
          });

          if (toolUse.name === "escalar_para_humano") {
            const inputObj =
              toolUse.input !== null && typeof toolUse.input === "object"
                ? (toolUse.input as Record<string, unknown>)
                : {};
            lastHandoff = {
              priority:
                typeof inputObj.priority === "string"
                  ? inputObj.priority
                  : "P2",
              motivo:
                typeof inputObj.motivo === "string" ? inputObj.motivo : "",
            };
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(output),
          });
        } catch (toolErr) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              error:
                toolErr instanceof Error
                  ? toolErr.message
                  : "Erro desconhecido na tool",
            }),
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });

      // Se já chegamos no teto, força extrair texto disponível (mesmo
      // que não-ideal) pra não deixar o cliente sem resposta.
      if (iterations >= MAX_TOOL_ITERATIONS) {
        finalText = extractFinalText(blocks);
        break;
      }
    }

    // 7. Persiste o turno final do assistant.
    await appendMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: finalText,
      toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : null,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      assistantMessage: finalText,
      toolCalls: collectedToolCalls,
      handoff: lastHandoff,
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/iara/sandbox/conversation", userId: user.id },
      "Falha ao processar mensagem da Iara. Tente novamente.",
    );
  }
}
