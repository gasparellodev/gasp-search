import "server-only";
import type { LeadInsert, MapperContext } from "@/lib/apify/run-and-persist";
import { normalizeWebsite } from "@/lib/apify/google-maps";

/**
 * Shape parcial do output do actor `apify~instagram-scraper` para o modo
 * de busca por user/hashtag. Campos extras vão para `raw`.
 */
export interface InstagramProfile {
  username?: string | null;
  fullName?: string | null;
  biography?: string | null;
  followersCount?: number | null;
  followsCount?: number | null;
  profilePicUrl?: string | null;
  externalUrl?: string | null;
  businessCategoryName?: string | null;
  isBusinessAccount?: boolean | null;
}

const HANDLE_INVALID = /[^a-z0-9._À-ɏ]/g; // lower-case + accentuated

/**
 * Normaliza handle do Instagram para a forma canônica:
 * - sem `@`
 * - lowercase (mantendo acentos)
 * - sem espaços / caracteres inválidos
 * Retorna null se vazio.
 */
export function normalizeInstagramHandle(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const noAt = lower.startsWith("@") ? lower.slice(1) : lower;
  const cleaned = noAt.replace(HANDLE_INVALID, "");
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Mapeia perfil do Instagram para `LeadInsert`. Retorna null se faltar
 * `username`.
 */
export function mapInstagramProfile(
  profile: InstagramProfile,
  ctx: MapperContext,
): LeadInsert | null {
  const handle = normalizeInstagramHandle(profile.username);
  if (!handle) return null;

  const fullName = profile.fullName?.trim();
  const name = fullName && fullName.length > 0 ? fullName : handle;

  const bio = profile.biography?.trim();
  const notes = bio && bio.length > 0 ? bio : null;

  const website = normalizeWebsite(profile.externalUrl);

  return {
    user_id: ctx.userId,
    source: ctx.source,
    source_search_job_id: ctx.jobId,
    name,
    instagram_handle: handle,
    category: profile.businessCategoryName ?? null,
    notes,
    website,
    has_website: website !== null,
    followers_count: profile.followersCount ?? null,
    raw: profile as never,
  };
}
