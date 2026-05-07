import { NextResponse } from "next/server";

type ApiErrorContext = Readonly<{
  route: string;
  userId?: string | null;
}>;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido";
}

export function apiErrorResponse(
  error: unknown,
  context: ApiErrorContext,
  userMessage: string,
  status = 502,
) {
  const requestId = crypto.randomUUID();

  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      route: context.route,
      userId: context.userId ?? null,
      message: errorMessage(error),
    }),
  );

  return NextResponse.json({ error: userMessage }, { status });
}
