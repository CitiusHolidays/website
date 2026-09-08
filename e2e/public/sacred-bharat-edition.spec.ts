import { expect, test } from "@playwright/test";
import { SACRED_BHARAT_EDITION_001 } from "../../src/data/sacredBharat/edition001";
import { isRuntimeObject, isRuntimeString } from "../../src/lib/runtimeValues";

test.describe("@critical Sacred Bharat Edition 001", () => {
  test("keeps the numbered archive and legacy unversioned share on Edition 001", async ({
    page,
  }) => {
    const recordedEditions: string[] = [];
    await page.route("**/api/auth/get-session", async (route) => {
      await route.fulfill({ body: "null", contentType: "application/json", status: 200 });
    });
    await page.route("**/api/sacred-bharat/events", async (route) => {
      const body = route.request().postDataJSON();
      if (isRuntimeObject(body) && "edition" in body && isRuntimeString(body.edition)) {
        recordedEditions.push(body.edition);
      }
      await route.fulfill({ body: "{}", contentType: "application/json", status: 202 });
    });

    await page.goto("/sacred-bharat/001");
    await expect(page).toHaveURL(/\/sacred-bharat\/001$/);
    await expect(page.getByText("Five visual details · No login")).toBeVisible();
    await expect.poll(() => recordedEditions).toContain("001");

    recordedEditions.length = 0;
    await page.goto(`/sacred-bharat?via=${"a".repeat(32)}`);
    await expect(page).toHaveURL(/\/sacred-bharat\?via=[a-f0-9]{32}$/);
    await expect(page.getByText("Five visual details · No login")).toBeVisible();
    await expect.poll(() => recordedEditions).toContain("001");

    const unknownEdition = await page.goto("/sacred-bharat/999");
    expect(unknownEdition?.status()).toBe(404);
  });

  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 844, width: 390 },
  ]) {
    test(`completes the anonymous edition and uses result disclosures at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/api/auth/get-session", async (route) => {
        await route.fulfill({ body: "null", contentType: "application/json", status: 200 });
      });
      await page.route("**/api/sacred-bharat/events", async (route) => {
        await route.fulfill({ body: "{}", contentType: "application/json", status: 202 });
      });

      await page.goto("/sacred-bharat");
      await expect(page.getByText("Five visual details · No login")).toBeVisible();

      for (const [index, question] of SACRED_BHARAT_EDITION_001.questions.entries()) {
        const answer = question.choices.find((choice) => choice.id === question.answer);
        if (!answer) {
          throw new Error(`Edition question ${question.id} must name its answer choice`);
        }

        await expect(
          page.getByRole("heading", { exact: true, name: question.prompt })
        ).toBeInViewport({
          ratio: 1,
        });
        await expect(page.getByRole("button", { exact: true, name: answer.label })).toBeInViewport({
          ratio: 1,
        });
        await expect(page.getByAltText(question.clueAlt)).toBeVisible();
        await expect(
          page.getByRole("link", { name: `${question.credit.author} · ${question.credit.license}` })
        ).toBeVisible();
        await page.getByRole("button", { exact: true, name: answer.label }).click();
        await expect(
          page.getByRole("heading", { exact: true, name: question.reveal })
        ).toBeVisible();
        await expect(
          page.getByRole("progressbar", {
            name: `Question ${index + 1} of ${SACRED_BHARAT_EDITION_001.questions.length}`,
          })
        ).toBeVisible();
        await page
          .getByRole("button", {
            exact: true,
            name:
              index === SACRED_BHARAT_EDITION_001.questions.length - 1
                ? "See my result"
                : "Next detail",
          })
          .click();
      }

      await expect(page.getByRole("heading", { exact: true, name: "5/5" })).toBeVisible();
      for (const name of ["Invite a friend", "Download", "Copy link"]) {
        await expect(page.getByRole("button", { exact: true, name })).toBeInViewport({ ratio: 1 });
      }

      const storySummary = page.getByText("Story preview and treatment", { exact: true });
      const recapSummary = page.getByText("Your edition recap", { exact: true });
      const treatment = page.getByRole("button", { exact: true, name: "Temple red" });
      await expect(treatment).toBeHidden();
      await storySummary.focus();
      await page.keyboard.press("Enter");
      await treatment.click();
      await expect(treatment).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("img", { name: "Temple red Story card preview: 5 out of 5. Every detail." })
      ).toBeVisible();
      await storySummary.focus();
      await page.keyboard.press("Enter");
      await expect(treatment).toBeHidden();
      await page.keyboard.press("Tab");
      await expect(recapSummary).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("region", { name: "The five details, in words" }).getByRole("listitem")
      ).toHaveCount(5);
      await expect(page.getByRole("button", { name: "Try the edition again" })).toBeVisible();

      await page.getByRole("button", { name: "Try the edition again" }).click();

      const [firstQuestion] = SACRED_BHARAT_EDITION_001.questions;
      if (!firstQuestion) {
        throw new Error("Sacred Bharat Edition 001 must include a first question");
      }

      await expect(
        page.getByRole("progressbar", {
          name: `Question 1 of ${SACRED_BHARAT_EDITION_001.questions.length}`,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          exact: true,
          name: firstQuestion.prompt,
        })
      ).toBeVisible();
    });
  }
});
