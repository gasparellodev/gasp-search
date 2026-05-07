import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { env } from "@/lib/env";
import {
  mapGoogleMapsPlace,
  type GoogleMapsPlace,
} from "@/lib/apify/google-maps";
import { runAndPersist } from "@/lib/apify/run-and-persist";
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
    const result = await runAndPersist<GoogleMapsPlace>({
      supabase,
      userId: user.id,
      source: "google_maps",
      actorId: env.APIFY_GOOGLE_MAPS_ACTOR_ID,
      input: parsed.data,
      mapper: mapGoogleMapsPlace,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Falha ao executar busca no Google Maps. Tente novamente." },
      { status: 502 },
    );
  }
}
