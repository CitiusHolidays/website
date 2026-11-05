import { expect, test } from "bun:test";
import { buildThankYouDraft } from "./guestContactPresentation";

test("thank-you is a manual draft with one recipient and no promotional copy", () => {
  const draft = buildThankYouDraft({
    email: "asha+tour@example.test",
    fullName: "Asha Rao",
    jobCode: "JC/TEST/001",
  });
  expect(draft).toContain("mailto:asha%2Btour%40example.test?");
  const params = new URLSearchParams(draft?.split("?")[1]);
  expect(params.get("subject")).toBe("Thank you for travelling with Citius Holidays | JC/TEST/001");
  expect(params.get("body")).toContain("Dear Asha Rao,");
  expect(params.has("bcc")).toBe(false);
  expect(buildThankYouDraft({ fullName: "Asha Rao" })).toBeNull();
  expect(
    buildThankYouDraft({
      email: "asha@example.test\r\nbcc:other@example.test",
      fullName: "Asha Rao",
    })
  ).toBeNull();
});
