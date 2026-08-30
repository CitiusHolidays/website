import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { mobilePortalTestTitle, PORTAL_E2E_MOBILE_ROLE_SCENARIOS } from "../registry/portalViews";

const MOBILE_VIEWPORT = { height: 844, width: 390 };

async function expectNoHorizontalPageOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(() => ({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }))
  ).toEqual(
    expect.objectContaining({
      body: expect.any(Number),
      document: expect.any(Number),
      viewport: MOBILE_VIEWPORT.width,
    })
  );
  const overflow = await page.evaluate(
    () =>
      Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("@smoke @mobile-quality Authenticated portal", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  for (const scenario of PORTAL_E2E_MOBILE_ROLE_SCENARIOS) {
    test(mobilePortalTestTitle(scenario.role), async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, scenario.role);
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(scenario.href);
      await expect(page.getByRole("heading", { name: scenario.heading }).first()).toBeVisible();
      await expectNoHorizontalPageOverflow(page);

      const navigationTrigger = page.getByRole("button", { name: "Open portal navigation" });
      await navigationTrigger.click();
      await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(navigationTrigger).toBeFocused();

      const accountTrigger = page.getByRole("button", { name: /Open account menu for/i });
      await accountTrigger.click();
      await expect(accountTrigger).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(accountTrigger).toBeFocused();
      await expectNoHorizontalPageOverflow(page);
      await context.close();
    });
  }

  test("[mobile-sales-query-actions] Sales Decision stays primary and More remains reachable", async ({
    browser,
  }) => {
    const { context, page } = await openPortalAs(browser, "sales");
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/portal/queries");
    await expect(page.getByRole("heading", { level: 2, name: /All Sales Queries/i })).toBeVisible();
    const more = page.getByRole("button", { name: /More actions for/i }).first();
    await expect(more).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Sales Decision" }).first()).toBeVisible();
    await more.click();
    await expect(page.getByRole("menu", { name: /More actions for/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await expectNoHorizontalPageOverflow(page);
    await context.close();
  });
});
