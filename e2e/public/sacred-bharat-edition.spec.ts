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

  test("completes the current anonymous edition and restarts without backend writes", async ({
    page,
  }) => {
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

      await page.getByRole("button", { exact: true, name: answer.label }).click();
      await expect(page.getByRole("heading", { exact: true, name: question.reveal })).toBeVisible();
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
});
