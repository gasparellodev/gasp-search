import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { LeadTagSummary } from "@/lib/leads/list-leads";
import type { CreateTagInput, UpdateTagInput } from "@/lib/validators/tags";

export type TagRow = LeadTagSummary & {
  user_id: string;
  created_at: string;
};

export class DuplicateTagError extends Error {
  readonly code = "duplicate_tag";
  constructor(message = "Tag já existe com esse nome") {
    super(message);
    this.name = "DuplicateTagError";
  }
}

export async function createTag({
  supabase,
  userId,
  input,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  input: CreateTagInput;
}): Promise<TagRow> {
  const { data, error } = await supabase
    .from("tags")
    .insert({
      user_id: userId,
      name: input.name,
      color: input.color,
    })
    .select("id, name, color, user_id, created_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new DuplicateTagError();
    }
    throw new Error(`Falha ao criar tag: ${error.message}`);
  }
  return data as unknown as TagRow;
}

export async function updateTag({
  supabase,
  id,
  input,
}: {
  supabase: SupabaseClient<Database>;
  id: string;
  input: UpdateTagInput;
}): Promise<TagRow | null> {
  const { data, error } = await supabase
    .from("tags")
    .update(input)
    .eq("id", id)
    .select("id, name, color, user_id, created_at")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") throw new DuplicateTagError();
    if (code === "PGRST116") return null; // no rows
    throw new Error(`Falha ao atualizar tag: ${error.message}`);
  }
  return data as unknown as TagRow;
}

export async function deleteTag({
  supabase,
  id,
}: {
  supabase: SupabaseClient<Database>;
  id: string;
}): Promise<boolean> {
  const { count, error } = (await supabase
    .from("tags")
    .delete({ count: "exact" })
    .eq("id", id)) as {
    count: number | null;
    error: { message: string } | null;
  };

  if (error) throw new Error(`Falha ao excluir tag: ${error.message}`);
  return (count ?? 0) > 0;
}
