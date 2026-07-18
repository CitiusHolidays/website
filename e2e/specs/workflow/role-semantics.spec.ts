import { expect, test } from "@playwright/test";
import { openPortalAs } from "../../helpers/auth";
import { hasE2eCredentials, E2E_SKIP_REASON } from "../../helpers/skip";

test.describe("@workflow sales decision is sales-only", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("contracting user does not see Sales Decision on queries list", async ({ browser }) => {
    const { context, page } = await openPortalAs(browser, "contracting");
    await page.goto("/portal/queries");
    await expect(page.getByRole("button", { name: "Sales Decision" })).toHaveCount(0);
    await context.close();
  });
});

test.describe("@workflow leave two-stage approval", () => {
  test.skip(true, "Head-then-HR approval chain tracked in ticket 19 backlog.");
});

test.describe("@workflow cement portal scope", () => {
  test.skip(true, "Cement-scoped role matrix tracked in ticket 19 backlog.");
});

test.describe("@workflow proposal handoff guard", () => {
  test.skip(true, "Incomplete pricing Send to Sales guard tracked in ticket 19 backlog.");
});
