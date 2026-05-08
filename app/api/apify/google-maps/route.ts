import { after, NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { env } from "@/lib/env";
import {
  mapGoogleMapsPlace,
  type GoogleMapsPlace,
} from "@/lib/apify/google-maps";
import { createSearchJob, executeSearchJob } from "@/lib/apify/run-and-persist";
import { createServerSupabase } from "@/lib/supabase/server";
import { searchGoogleMapsSchema } from "@/lib/validators/search";

export const maxDuration = 300;

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
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
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

  const parsed = searchGoogleMapsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Body inválido",
        issues: validationIssues(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const jobId = await createSearchJob({
      supabase,
      userId: user.id,
      source: "google_maps",
      input: parsed.data,
    });

    // Execução do actor Apify em background — não bloqueia a resposta.
    // Enrich de contato é exclusivamente manual (botão "Enriquecer
    // selecionados" em /leads → POST /api/apify/enrich).
    after(async () => {
      try {
        await executeSearchJob<GoogleMapsPlace>({
          supabase,
          userId: user.id,
          jobId,
          source: "google_maps",
          actorId: env.APIFY_GOOGLE_MAPS_ACTOR_ID,
          input: parsed.data,
          mapper: mapGoogleMapsPlace,
        });
      } catch {
        // executeSearchJob já marca o job como "failed" internamente.
        // Não relançar para não crashar o background callback.
      }
    });

    return NextResponse.json({ jobId, status: "queued" });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/apify/google-maps", userId: user.id },
      "Falha ao criar busca no Google Maps. Tente novamente.",
    );
  }
}
