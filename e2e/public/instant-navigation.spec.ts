import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

const DIRECT_CASES = [
  {
    finalHeading: /Your next great journey/i,
    instantHeading: /Your next great journey/i,
    path: "/",
  },
  {
    finalHeading: "Kailash Mansarovar Yatra 2026",
    instantHeading: /Spiritual Trail|Kailash Mansarovar Yatra 2026/i,
    path: "/pilgrimage/kailash-mansarovar-14day",
  },
  {
    finalHeading: "Get in Touch",
    instantHeading: "Get in Touch",
    path: "/contact?intent=pilgrimage-callback",
  },
  {
    finalHeading: "Terms & Conditions",
    instantHeading: "Legal & Policies",
    path: "/policies?view=terms",
  },
] as const;

test.describe("Credential-free public instant navigation", () => {
  for (const route of DIRECT_CASES) {
    test(`${route.path} exposes useful direct-load shell and final content`, async ({
      page,
      baseURL,
    }) => {
      await instant(
        page,
        async () => {
          await page.goto(route.path);
          await expect(page.getByRole("link", { exact: true, name: "Citius" })).toBeVisible();
          await expect(page.getByRole("heading", { name: route.instantHeading })).toBeVisible();
        },
        { baseURL }
      );
      await expect(page.getByRole("heading", { name: route.finalHeading })).toBeVisible();
    });
  }

  test("reuses the contact shell through a real homepage Link", async ({ page }) => {
    await page.goto("/");

    await instant(page, async () => {
      await page.getByRole("banner").getByRole("link", { exact: true, name: "Contact" }).click();
      await page.waitForURL((url) => url.pathname === "/contact");
      await expect(page.getByRole("status", { name: "Loading Get in Touch" })).toBeVisible();
      await expect(
        page.getByRole("heading", { exact: true, name: "Let's Start a Conversation" })
      ).toHaveCount(0);
    });

    await expect(
      page.getByRole("heading", { exact: true, name: "Let's Start a Conversation" })
    ).toBeVisible();
  });

  test("reuses the policy shell through a real footer Link", async ({ page }) => {
    await page.goto("/");

    await instant(page, async () => {
      await page.getByRole("contentinfo").getByRole("link", { name: "Legal & Policies" }).click();
      await page.waitForURL((url) => url.pathname === "/policies");
      await expect(page.getByRole("status", { name: "Loading Legal & Policies" })).toBeVisible();
      await expect(
        page.getByRole("heading", { exact: true, name: "Terms & Conditions" })
      ).toHaveCount(0);
    });

    await expect(
      page.getByRole("heading", { exact: true, name: "Terms & Conditions" })
    ).toBeVisible();
  });
});

test.describe("Credential-free public mobile navigation", () => {
  test("Composes current routes and persistent actions without an empty middle band", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
    const openMenu = page.getByRole("button", { name: "Open menu" });
    await expect(openMenu).toBeVisible();
    await expect
      .poll(async () => {
        if ((await dialog.count()) > 0) {
          return true;
        }
        await openMenu.click();
        return false;
      })
      .toBe(true);

    const geometry = await dialog.evaluate((element) => {
      const heading = element.querySelector<HTMLElement>("[data-mobile-menu-heading]");
      const navigation = element.querySelector<HTMLElement>('nav[aria-label="Primary"]');
      const actions = element.querySelector<HTMLElement>("[data-mobile-menu-actions]");
      if (!(heading && navigation && actions)) {
        throw new Error("Mobile navigation geometry owner was missing");
      }
      const blocks = [heading, ...navigation.children, actions]
        .map((block) => block.getBoundingClientRect())
        .filter((rect) => rect.height > 0);
      const gaps = blocks.slice(1).map((rect, index) => rect.top - blocks[index].bottom);
      return {
        actionsBottom: actions.getBoundingClientRect().bottom,
        bodyFont: getComputedStyle(document.body).fontFamily,
        headingFont: getComputedStyle(heading).fontFamily,
        maxGap: Math.max(...gaps),
        viewportHeight: window.innerHeight,
      };
    });

    expect(geometry.maxGap).toBeLessThanOrEqual(64);
    expect(geometry.actionsBottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.bodyFont).toContain("Inter");
    expect(geometry.headingFont).toContain("Poppins");
    await expect(
      dialog.locator('a[aria-current="page"] [data-current-route-marker]')
    ).toBeVisible();
  });
});
