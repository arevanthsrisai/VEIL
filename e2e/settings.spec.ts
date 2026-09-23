import { test, expect } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";

// webServer sets E2E_SKIP_RATE_LIMIT=1, so the in-memory rate limiter is bypassed
// in e2e — no 429 assertions here. Admin-only flows (GET/PUT as ADMIN, audit log
// view) need a bootstrapped admin account via scripts/bootstrap-admin.mjs; these
// tests cover gating with a regular user only.

test.describe("settings API", () => {
  test("non-admin cannot read or write admin settings", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const getRes = await page.request.get("/api/admin/settings");
    expect(getRes.status()).toBe(403);
    const putRes = await page.request.put("/api/admin/settings", {
      data: { key: "maintenance_mode", value: true },
    });
    expect(putRes.status()).toBe(403);
  });

  test("unauthenticated settings access is rejected", async ({ request }) => {
    const getRes = await request.get("/api/admin/settings");
    expect(getRes.status()).toBe(401);
    const putRes = await request.put("/api/admin/settings", {
      data: { key: "registration_enabled", value: false },
    });
    expect(putRes.status()).toBe(401);
  });

  test("announcements endpoint is public", async ({ page }) => {
    const res = await page.request.get("/api/announcements");
    expect(res.status()).toBe(200);
    const data = (await res.json()) as {
      announcement: string | null;
      maintenanceMode: boolean;
    };
    // shared dev DB: an admin may have set a real announcement — assert shape
    expect(data.announcement === null || typeof data.announcement === "string").toBe(true);
    expect(typeof data.maintenanceMode).toBe("boolean");
  });
});
