import { expect, test } from "@playwright/test";
import { describeWithAuth, loginAs } from "../_helpers/auth";

const QR_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=";

test.describe("whatsapp", () => {
  test.skip(
    !describeWithAuth(),
    "Fluxo autenticado exige E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.",
  );

  test("/settings → Conectar WhatsApp → QR aparece (Evolution mockado)", async ({
    page,
  }) => {
    // Mock POST instance: cria e devolve qr_pending sem qrcode (v2.3.x).
    await page.route("**/api/whatsapp/instance", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            status: "qr_pending",
            evoInstance: "user_test1234",
            qrcode: null,
          }),
        });
      } else if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "qr_pending",
            phoneNumber: null,
            lastSeenAt: null,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock GET /qr — devolve base64 fake.
    await page.route("**/api/whatsapp/instance/qr", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          qrcode: QR_BASE64,
          pairingCode: null,
          status: "qr_pending",
        }),
      });
    });

    await loginAs(page, "/settings");

    // Card de WhatsApp existe
    await expect(page.getByTestId("whatsapp-instance-card")).toBeVisible();

    // Se já está conectado/qr_pending, aceita estado mas valida elemento.
    // Se está disconnected, clica Conectar.
    const connectBtn = page.getByRole("button", { name: /conectar whatsapp/i });
    if (await connectBtn.isVisible().catch(() => false)) {
      await connectBtn.click();
    }

    // QR <img> ou skeleton aparece
    const qrOrSkeleton = page
      .getByTestId("whatsapp-qrcode")
      .or(page.locator('[role="status"]').first());
    await expect(qrOrSkeleton.first()).toBeVisible({ timeout: 10_000 });
  });
});
