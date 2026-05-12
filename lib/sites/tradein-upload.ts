import "server-only";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic"] as const;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export type TradeinPhotoExtension = (typeof ALLOWED_EXTENSIONS)[number];
export type TradeinPhotoMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface TradeinUploadValidationInput {
  ext: string;
  mimeType: string;
  sizeBytes: number;
  magicHeader: string;
}

export type TradeinUploadValidationResult =
  | {
      ok: true;
      ext: TradeinPhotoExtension;
      mimeType: TradeinPhotoMimeType;
    }
  | { ok: false; error: string };

export function validateTradeinUploadRequest(
  input: TradeinUploadValidationInput,
): TradeinUploadValidationResult {
  const ext = normalizeTradeinExtension(input.ext);
  if (!ext) {
    return { ok: false, error: "Formato de foto não suportado." };
  }

  const mimeType = normalizeTradeinMimeType(input.mimeType);
  if (!mimeType) {
    return { ok: false, error: "Tipo de foto não suportado." };
  }

  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "Foto inválida." };
  }

  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Foto maior que 5MB." };
  }

  if (!magicHeaderMatches(ext, mimeType, input.magicHeader)) {
    return { ok: false, error: "Assinatura do arquivo inválida." };
  }

  return { ok: true, ext, mimeType };
}

export function buildTradeinPhotoPath({
  leadId,
  index,
  timestamp,
  ext,
}: {
  leadId: string;
  index: number;
  timestamp: number;
  ext: TradeinPhotoExtension;
}) {
  const safeLeadId = leadId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeIndex = Math.max(0, Math.trunc(index));
  const safeTimestamp = Math.max(0, Math.trunc(timestamp));
  return `${safeLeadId}/${safeIndex}-${safeTimestamp}.${ext}`;
}

function normalizeTradeinExtension(ext: string): TradeinPhotoExtension | null {
  const normalized = ext.trim().replace(/^\./, "").toLowerCase();
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(normalized)
    ? (normalized as TradeinPhotoExtension)
    : null;
}

function normalizeTradeinMimeType(mimeType: string): TradeinPhotoMimeType | null {
  const normalized = mimeType.trim().toLowerCase();
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(normalized)
    ? (normalized as TradeinPhotoMimeType)
    : null;
}

function magicHeaderMatches(
  ext: TradeinPhotoExtension,
  mimeType: TradeinPhotoMimeType,
  hex: string,
) {
  const normalized = hex.trim().toLowerCase();
  if (!/^[a-f0-9]{8,24}$/.test(normalized)) return false;

  if (mimeType === "image/jpeg" || ext === "jpg" || ext === "jpeg") {
    return normalized.startsWith("ffd8ff");
  }
  if (mimeType === "image/png" || ext === "png") {
    return normalized.startsWith("89504e470d0a1a0a");
  }
  if (mimeType === "image/webp" || ext === "webp") {
    return normalized.startsWith("52494646") && normalized.slice(16, 24) === "57454250";
  }
  if (mimeType === "image/heic" || ext === "heic") {
    return normalized.slice(8, 16) === "66747970";
  }
  return false;
}
