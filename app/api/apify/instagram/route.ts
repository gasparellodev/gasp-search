import { after, NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { env } from "@/lib/env";
import {
  mapInstagramProfile,
  type InstagramProfile,
} from "@/lib/apify/instagram";
import { createSearchJob, executeSearchJob } from "@/lib/apify/run-and-persist";
import { createServerSupabase } from "@/lib/supabase/server";
import { searchInstagramSchema } from "@/lib/validators/search";

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

  const parsed = searchInstagramSchema.safeParse(body);
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
      source: "instagram",
      input: parsed.data,
    });

    after(async () => {
      try {
        await executeSearchJob<InstagramProfile>({
          supabase,
          userId: user.id,
          jobId,
          source: "instagram",
          actorId: env.APIFY_INSTAGRAM_ACTOR_ID,
          input: parsed.data,
          mapper: mapInstagramProfile,
          onConflict: "user_id,source,instagram_handle",
        });
      } catch {
        // executeSearchJob already handles errors internally by updating the job status
      }
    });

    return NextResponse.json({ jobId, status: "queued" });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/apify/instagram", userId: user.id },
      "Falha ao criar busca no Instagram. Tente novamente.",
    );
  }
}
