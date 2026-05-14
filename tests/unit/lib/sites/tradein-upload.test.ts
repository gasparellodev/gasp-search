import { describe, expect, it } from "vitest";

import {
  buildTradeinPhotoPath,
  validateTradeinUploadRequest,
} from "@/lib/sites/tradein-upload";

describe("validateTradeinUploadRequest()", () => {
  it("aceita JPEG com magic bytes compatíveis", () => {
    expect(
      validateTradeinUploadRequest({
        ext: "jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        magicHeader: "ffd8ffe000104a4649460001",
      }),
    ).toMatchObject({ ok: true, ext: "jpg", mimeType: "image/jpeg" });
  });

  it("rejeita formatos não permitidos", () => {
    expect(
      validateTradeinUploadRequest({
        ext: "gif",
        mimeType: "image/gif",
        sizeBytes: 1024,
        magicHeader: "474946383961",
      }),
    ).toEqual({ ok: false, error: "Formato de foto não suportado." });
  });

  it("rejeita arquivos acima de 5MB", () => {
    expect(
      validateTradeinUploadRequest({
        ext: "png",
        mimeType: "image/png",
        sizeBytes: 5 * 1024 * 1024 + 1,
        magicHeader: "89504e470d0a1a0a00000000",
      }),
    ).toEqual({ ok: false, error: "Foto maior que 5MB." });
  });
});

describe("buildTradeinPhotoPath()", () => {
  it("gera path estável no bucket privado", () => {
    expect(
      buildTradeinPhotoPath({
        leadId: "lead-123",
        index: 1,
        timestamp: 1710000000000,
        ext: "webp",
      }),
    ).toBe("lead-123/1-1710000000000.webp");
  });
});
