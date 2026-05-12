import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

const FORM_SCOPE = "announcement-form-v1";
const UPLOAD_SCOPE = "announcement-upload-v1";

export function createAnnouncementFormSignature(input: {
  siteId: string;
  targetSlug: string | null;
}) {
  return signPayload(FORM_SCOPE, [input.siteId, input.targetSlug ?? ""]);
}

export function verifyAnnouncementFormSignature(input: {
  siteId: string;
  targetSlug: string | null;
  signature?: string | null;
}) {
  return verifyPayload(FORM_SCOPE, [input.siteId, input.targetSlug ?? ""], input.signature);
}

export function createAnnouncementUploadToken(input: {
  siteId: string;
  leadId: string;
}) {
  return signPayload(UPLOAD_SCOPE, [input.siteId, input.leadId]);
}

export function verifyAnnouncementUploadToken(input: {
  siteId: string;
  leadId: string;
  token?: string | null;
}) {
  return verifyPayload(UPLOAD_SCOPE, [input.siteId, input.leadId], input.token);
}

export function verifySameOrigin(origin: string | null) {
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(env.NEXT_PUBLIC_APP_URL).origin;
  } catch {
    return false;
  }
}

function signPayload(scope: string, parts: string[]) {
  const secret = env.SITE_FORM_HMAC_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update([scope, ...parts].join("\n")).digest("hex");
}

function verifyPayload(scope: string, parts: string[], signature?: string | null) {
  const secret = env.SITE_FORM_HMAC_SECRET;
  if (!secret) return true;
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = createHmac("sha256", secret)
    .update([scope, ...parts].join("\n"))
    .digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
