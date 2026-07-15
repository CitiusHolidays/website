import { describe, expect, test } from "bun:test";
import { contactEmailEventId, contactEmailText } from "./contactEmailContent";

const complete = {
  email: "traveller@example.com",
  formLoadedAt: 1_789_000_000_000,
  message: "Please help plan a private journey.",
  name: "A Traveller",
  phone: "+1 555-123-4567",
  subject: "Private journey",
};

describe("contact email content", () => {
  test("keeps event identity stable for request replay and changes it for a new form load", async () => {
    const first = await contactEmailEventId(complete);
    const replay = await contactEmailEventId({ ...complete });
    const nextSubmission = await contactEmailEventId({
      ...complete,
      formLoadedAt: 1_789_000_000_001,
    });
    expect(first).toBe(replay);
    expect(nextSubmission).not.toBe(first);
    expect(first).toMatch(/^[a-f0-9]{40}$/);
  });

  test("orders labelled fields and safely omits an absent phone", () => {
    const text = contactEmailText({ ...complete, phone: "" });
    expect(text).toContain(
      "Name: A Traveller\nEmail: traveller@example.com\nSubject: Private journey"
    );
    expect(text).not.toContain("Phone:");
    expect(text).not.toMatch(/[📧👤📞📋💬]/u);
  });
});
