import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

const CASES = [
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
    finalHeading: "Shiva Trail",
    instantHeading: /Sacred Bharat trail|Shiva Trail/i,
    path: "/sacred-bharat/trails/shiva-trail",
  },
] as const;

test.describe("Credential-free public instant navigation", () => {
  for (const route of CASES) {
    test(`${route.path} Exposes useful instant and final content`, async ({ page, baseURL }) => {
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
});
