import { expect, test } from "@playwright/test";

const BILLING_POLICY_URL = /\/policies\?view=billing$/;
const PILGRIMAGE_CALLBACK_URL = /\/contact\?intent=pilgrimage-callback$/;
const PILGRIMAGE_ENQUIRY_URL = /\/contact\?intent=pilgrimage-enquiry$/;

function channelLuminance(channel: number) {
  const value = channel / 255;
  return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function compositedColors(element: Element, surfaceSelector: string) {
  const surface = element.closest(surfaceSelector);
  if (!surface) {
    throw new Error(`Missing contrast surface: ${surfaceSelector}`);
  }
  const style = getComputedStyle(surface);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas color compositing is unavailable");
  }
  // Black and white bound the scenery behind a translucent card. Canvas resolves CSS color and alpha.
  const pairs = ["#000000", "#ffffff"].map((backdrop) => {
    context.fillStyle = backdrop;
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = style.backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const background = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    context.fillStyle = getComputedStyle(element).color;
    context.fillRect(0, 0, 1, 1);
    const foreground = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    return { background, foreground };
  });
  return { backgroundImage: style.backgroundImage, blendMode: style.backgroundBlendMode, pairs };
}

function contrastRatio(foreground: number[], background: number[]) {
  const luminance = ([red, green, blue]: number[]) =>
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue);
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

async function expectConciergeFocusLifecycle(page: import("@playwright/test").Page) {
  const opener = page.getByRole("button", { exact: true, name: "Open Citius Concierge" });
  await opener.focus();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Citius Concierge" });
  await expect(dialog).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  await expect(page.locator('[role="log"]')).toHaveCount(1);
  await expect(dialog.locator('[role="status"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Close chat" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.getByRole("button", { name: "Minimize chat" }).click();
  await expect(page.getByRole("button", { name: "Expand chat" })).toBeVisible();
  await page.getByRole("button", { name: "Expand chat" }).click();
  await expect(dialog.locator('[role="status"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.getByRole("button", { name: "Close chat" }).click();
  await expect(opener).toBeFocused();
}

async function expectFooterMutedContrast(page: import("@playwright/test").Page) {
  const footerPair = await page
    .locator("footer .text-brand-muted-on-dark")
    .first()
    .evaluate(compositedColors, "footer");
  expect(footerPair.blendMode).toBe("multiply");
  for (const pair of footerPair.pairs) {
    expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
  }
}

test.describe("@smoke Public interface accessibility matrix", () => {
  test("Concierge owns one modal, contains focus, and restores its durable opener", async ({
    page,
  }) => {
    await page.goto("/");
    await expectConciergeFocusLifecycle(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await expectConciergeFocusLifecycle(page);
  });

  for (const scenario of [
    { current: "Terms & Conditions", heading: "Terms & Conditions", view: "terms" },
    { current: "Billing Policy", heading: "Billing & Payment Policy", view: "billing" },
    { current: "Terms & Conditions", heading: "Terms & Conditions", view: "unexpected" },
  ]) {
    test(`Policy ${scenario.view} renders truthful initial state`, async ({ page }) => {
      await page.goto(`/policies?view=${scenario.view}`);
      await expect(page.getByRole("heading", { name: scenario.heading })).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Policy documents" })
          .getByRole("link", { name: scenario.current })
      ).toHaveAttribute("aria-current", "page");
    });
  }

  test("Policy tabs preserve refresh and browser history semantics at 390px", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/policies");
    await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Policy documents" })
      .getByRole("link", { name: "Billing Policy" })
      .click();
    await expect(page).toHaveURL(BILLING_POLICY_URL);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Billing & Payment Policy" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Billing & Payment Policy" })).toBeVisible();
  });

  for (const scenario of [
    {
      intent: "pilgrimage-callback",
      message: "Please contact me about a Citius pilgrimage programme.",
      subject: "Pilgrimage callback request",
    },
    {
      intent: "pilgrimage-enquiry",
      message: "I would like to learn more about Citius pilgrimage programmes.",
      subject: "Pilgrimage programme enquiry",
    },
  ]) {
    test(`Contact ${scenario.intent} arrives with an editable brief`, async ({ page }) => {
      await page.goto(`/contact?intent=${scenario.intent}`);
      const subject = page.getByRole("textbox", { name: "Subject" });
      const message = page.getByRole("textbox", { name: "Message" });
      await expect(subject).toHaveValue(scenario.subject);
      await expect(message).toHaveValue(scenario.message);
      await subject.fill("Edited pilgrimage brief");
      await expect(subject).toHaveValue("Edited pilgrimage brief");
    });
  }

  test("Pilgrimage action labels preserve distinct destinations", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/pilgrimage");
    await page.getByRole("link", { name: "Request Callback" }).click();
    await expect(page).toHaveURL(PILGRIMAGE_CALLBACK_URL);
    await expect(page.getByRole("textbox", { name: "Subject" })).toHaveValue(
      "Pilgrimage callback request"
    );
    await page.goBack();
    await page.getByRole("link", { exact: true, name: "Enquire" }).click();
    await expect(page).toHaveURL(PILGRIMAGE_ENQUIRY_URL);
    await expect(page.getByRole("textbox", { name: "Subject" })).toHaveValue(
      "Pilgrimage programme enquiry"
    );
  });

  test("Unknown contact intents preserve the ordinary blank form", async ({ page }) => {
    await page.goto("/contact?intent=unexpected");
    await expect(page.getByRole("textbox", { name: "Subject" })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("");
  });

  test("Rendered Footer and auth muted copy retain AA contrast on their actual surfaces", async ({
    page,
  }) => {
    await page.goto("/");
    await expectFooterMutedContrast(page);

    for (const route of ["/auth/guest", "/auth/forgot-password", "/auth/email-verified"]) {
      await page.goto(route);
      const authPair = await page
        .getByRole("heading", { level: 1 })
        .locator("..")
        .locator("p")
        .evaluate(compositedColors, "section");
      expect(authPair.backgroundImage).toBe("none");
      for (const pair of authPair.pairs) {
        expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
      }
    }

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/");
    await expectFooterMutedContrast(page);
  });
});
