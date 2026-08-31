import { instant } from "@next/playwright";
import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __mobileMenuAnimationDurations?: number[];
  }
}

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

async function openMobileNavigation(page: Page) {
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
  return dialog;
}

async function mockSignedInAccount(page: Page) {
  const timestamp = "2026-08-30T12:00:00.000Z";
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        session: {
          createdAt: timestamp,
          expiresAt: "2026-09-30T12:00:00.000Z",
          id: "public-mobile-session",
          token: "public-mobile-session-token",
          updatedAt: timestamp,
          userId: "public-mobile-user",
        },
        user: {
          createdAt: timestamp,
          email: "mobile-account@example.test",
          emailVerified: true,
          id: "public-mobile-user",
          name: "Mobile Account",
          updatedAt: timestamp,
        },
      },
      status: 200,
    });
  });
}

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
  test.use({ hasTouch: true });

  test("keeps the 390 by 844 composition balanced with coarse touch targets", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/");

    const dialog = await openMobileNavigation(page);
    await expect
      .poll(() =>
        dialog
          .locator("[data-mobile-menu-sheet]")
          .evaluate((element) => getComputedStyle(element).transform)
      )
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    const geometry = await dialog.evaluate((element) => {
      const heading = element.querySelector<HTMLElement>("[data-mobile-menu-heading]");
      const navigation = element.querySelector<HTMLElement>('nav[aria-label="Primary"]');
      const actions = element.querySelector<HTMLElement>("[data-mobile-menu-actions]");
      const sheet = element.querySelector<HTMLElement>("[data-mobile-menu-sheet]");
      const close = element.querySelector<HTMLElement>('button[aria-label="Close menu"]');
      if (!(heading && navigation && actions && sheet && close)) {
        throw new Error("Mobile navigation geometry owner was missing");
      }
      const blocks = [heading, ...navigation.children, actions]
        .map((block) => block.getBoundingClientRect())
        .filter((rect) => rect.height > 0);
      const gaps = blocks.slice(1).map((rect, index) => rect.top - blocks[index].bottom);
      const controls = Array.from(element.querySelectorAll<HTMLElement>("a, button, summary"))
        .map((control) => control.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      return {
        actionsBottom: actions.getBoundingClientRect().bottom,
        bodyFont: getComputedStyle(document.body).fontFamily,
        controlFont: getComputedStyle(close).fontFamily,
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headingFont: getComputedStyle(heading).fontFamily,
        maxGap: Math.max(...gaps),
        minControlHeight: Math.min(...controls.map((rect) => rect.height)),
        minControlWidth: Math.min(...controls.map((rect) => rect.width)),
        sheetBottom: sheet.getBoundingClientRect().bottom,
        sheetRight: sheet.getBoundingClientRect().right,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expect(geometry.maxGap).toBeLessThanOrEqual(64);
    expect(geometry.actionsBottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.sheetBottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.sheetRight).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.documentOverflow).toBeLessThanOrEqual(0);
    expect(geometry.minControlHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.minControlWidth).toBeGreaterThanOrEqual(44);
    expect(geometry.bodyFont).toContain("Inter");
    expect(geometry.controlFont).toContain("Inter");
    expect(geometry.headingFont).toContain("Poppins");
    await expect(
      dialog.locator('a[aria-current="page"] [data-current-route-marker]')
    ).toBeVisible();
    await dialog.getByRole("link", { exact: true, name: "Contact" }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("heading", { exact: true, name: "Get in Touch" })).toBeVisible();
  });

  test("keeps a signed-in 390 by 640 large-text footer reachable across safe areas", async ({
    page,
  }) => {
    await mockSignedInAccount(page);
    await page.setViewportSize({ height: 640, width: 390 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const animationDurations: number[] = [];
      const nativeAnimate = Element.prototype.animate;
      window.__mobileMenuAnimationDurations = animationDurations;
      Element.prototype.animate = function (...args) {
        const animation = nativeAnimate.apply(this, args);
        if (
          this instanceof HTMLElement &&
          (this.matches('[aria-label="Mobile navigation"]') ||
            this.matches("[data-mobile-menu-sheet]"))
        ) {
          const duration = Number(animation.effect?.getTiming().duration);
          animationDurations.push(duration);
          if (duration > 0) {
            animation.pause();
          }
        }
        return animation;
      };
    });
    await page.goto("/");
    await page.addStyleTag({
      content: `:root {
        font-size: 20px;
        --safe-area-inset-top: 28px;
        --safe-area-inset-right: 24px;
        --safe-area-inset-bottom: 32px;
        --safe-area-inset-left: 26px;
      }`,
    });

    const dialog = await openMobileNavigation(page);
    const signOut = dialog.getByRole("button", { name: "Sign Out" });

    const reducedMotion = await dialog.evaluate((element) => {
      const sheet = element.querySelector<HTMLElement>("[data-mobile-menu-sheet]");
      const animationDurations = window.__mobileMenuAnimationDurations;
      if (!sheet) {
        throw new Error("Mobile navigation sheet was missing");
      }
      if (!Array.isArray(animationDurations)) {
        throw new Error("Mobile navigation animation instrumentation was missing");
      }
      return {
        animationCount: element.getAnimations({ subtree: true }).length,
        longestAnimationMs: Math.max(0, ...animationDurations),
        mediaMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
        sheetTransform: getComputedStyle(sheet).transform,
      };
    });
    expect(reducedMotion.mediaMatches).toBe(true);
    expect(reducedMotion.animationCount).toBe(0);
    expect(reducedMotion.longestAnimationMs).toBe(0);
    expect(reducedMotion.sheetTransform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await expect(dialog.getByRole("link", { exact: true, name: "My Account" })).toBeVisible();
    await expect(signOut).toBeVisible();

    await dialog.locator("details > summary").click();
    const geometry = await dialog.evaluate(async (element) => {
      const heading = element.querySelector<HTMLElement>("[data-mobile-menu-heading]");
      const navigation = element.querySelector<HTMLElement>('nav[aria-label="Primary"]');
      const actions = element.querySelector<HTMLElement>("[data-mobile-menu-actions]");
      const scroll = element.querySelector<HTMLElement>("[data-mobile-menu-scroll]");
      const sheet = element.querySelector<HTMLElement>("[data-mobile-menu-sheet]");
      const close = element.querySelector<HTMLElement>('button[aria-label="Close menu"]');
      const signOutControl = Array.from(element.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Sign Out"
      );
      const trailLinks = Array.from(element.querySelectorAll<HTMLAnchorElement>("details a[href]"));
      const lastTrailLink = trailLinks.at(-1);
      const header = close?.parentElement;
      const scrollContent = scroll?.firstElementChild;
      if (
        !(
          heading &&
          navigation &&
          actions &&
          scroll &&
          scrollContent &&
          sheet &&
          close &&
          header &&
          signOutControl &&
          lastTrailLink
        )
      ) {
        throw new Error("Mobile navigation geometry owner was missing");
      }
      const controls = Array.from(element.querySelectorAll<HTMLElement>("a, button, summary"))
        .map((control) => control.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      scroll.scrollTop = scroll.scrollHeight;
      lastTrailLink.focus();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const actionStyle = getComputedStyle(actions);
      const headerStyle = getComputedStyle(header);
      const scrollContentStyle = getComputedStyle(scrollContent);
      const scrollRect = scroll.getBoundingClientRect();
      const trailRect = lastTrailLink.getBoundingClientRect();
      const trailHit = document.elementFromPoint(
        trailRect.left + trailRect.width / 2,
        trailRect.top + trailRect.height / 2
      );
      signOutControl.focus();
      const signOutRect = signOutControl.getBoundingClientRect();
      const signOutHit = document.elementFromPoint(
        signOutRect.left + signOutRect.width / 2,
        signOutRect.top + signOutRect.height / 2
      );
      return {
        actionsBottom: actions.getBoundingClientRect().bottom,
        actionsPaddingBottom: Number.parseFloat(actionStyle.paddingBottom),
        actionsPaddingLeft: Number.parseFloat(actionStyle.paddingLeft),
        actionsPaddingRight: Number.parseFloat(actionStyle.paddingRight),
        bodyFont: getComputedStyle(document.body).fontFamily,
        controlFont: getComputedStyle(close).fontFamily,
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerPaddingLeft: Number.parseFloat(headerStyle.paddingLeft),
        headerPaddingRight: Number.parseFloat(headerStyle.paddingRight),
        headerPaddingTop: Number.parseFloat(headerStyle.paddingTop),
        headingFont: getComputedStyle(heading).fontFamily,
        lastTrailBottom: trailRect.bottom,
        lastTrailTop: trailRect.top,
        lastTrailUnobscured: Boolean(
          trailHit && (trailHit === lastTrailLink || lastTrailLink.contains(trailHit))
        ),
        minControlHeight: Math.min(...controls.map((rect) => rect.height)),
        minControlWidth: Math.min(...controls.map((rect) => rect.width)),
        rootFontSize: getComputedStyle(document.documentElement).fontSize,
        scrollOverflow: scroll.scrollHeight > scroll.clientHeight,
        scrollPaddingLeft: Number.parseFloat(scrollContentStyle.paddingLeft),
        scrollPaddingRight: Number.parseFloat(scrollContentStyle.paddingRight),
        scrollTop: scroll.scrollTop,
        scrollViewportBottom: scrollRect.bottom,
        scrollViewportTop: scrollRect.top,
        sheetBottom: sheet.getBoundingClientRect().bottom,
        sheetRight: sheet.getBoundingClientRect().right,
        sheetTransform: getComputedStyle(sheet).transform,
        signOutBottom: signOutRect.bottom,
        signOutTop: signOutRect.top,
        signOutUnobscured: Boolean(
          signOutHit && (signOutHit === signOutControl || signOutControl.contains(signOutHit))
        ),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expect(geometry.actionsBottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.actionsPaddingBottom).toBe(32);
    expect(geometry.actionsPaddingLeft).toBe(26);
    expect(geometry.actionsPaddingRight).toBe(24);
    expect(geometry.sheetBottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.sheetRight).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.documentOverflow).toBeLessThanOrEqual(0);
    expect(geometry.headerPaddingLeft).toBe(26);
    expect(geometry.headerPaddingRight).toBe(24);
    expect(geometry.headerPaddingTop).toBe(28);
    expect(geometry.minControlHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.minControlWidth).toBeGreaterThanOrEqual(44);
    expect(geometry.rootFontSize).toBe("20px");
    expect(geometry.scrollPaddingLeft).toBe(26);
    expect(geometry.scrollPaddingRight).toBe(24);
    expect(geometry.scrollOverflow).toBe(true);
    expect(geometry.scrollTop).toBeGreaterThan(0);
    expect(geometry.lastTrailTop).toBeGreaterThanOrEqual(geometry.scrollViewportTop - 1);
    expect(geometry.lastTrailBottom).toBeLessThanOrEqual(geometry.scrollViewportBottom + 1);
    expect(geometry.lastTrailUnobscured).toBe(true);
    expect(geometry.sheetTransform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(geometry.signOutTop).toBeGreaterThanOrEqual(0);
    expect(geometry.signOutBottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.signOutUnobscured).toBe(true);
    expect(geometry.bodyFont).toContain("Inter");
    expect(geometry.controlFont).toContain("Inter");
    expect(geometry.headingFont).toContain("Poppins");
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("preserves desktop navigation and the approved Auth font", async ({ page }) => {
    await page.setViewportSize({ height: 720, width: 1280 });
    await page.goto("/");

    const banner = page.getByRole("banner");
    await expect(banner.locator("nav")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(0);

    await page.goto("/auth/connect");
    const authFonts = await page
      .getByRole("button", { name: /Continue with Google/i })
      .evaluate((control) => ({
        body: getComputedStyle(document.body).fontFamily,
        control: getComputedStyle(control).fontFamily,
      }));
    expect(authFonts.body).toContain("Inter");
    expect(authFonts.control).toContain("Inter");
  });
});
