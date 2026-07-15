import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("contact email delivery boundary", () => {
  test("uses the shared retry and idempotency boundary while retaining reply-to routing", () => {
    const source = readFileSync(new URL("./deliverContactEmail.ts", import.meta.url), "utf8");
    expect(source).toContain("deliverNotificationEmailsSequentially");
    expect(source).toContain('idempotencyNamespace: "contact-form"');
    expect(source).toContain("replyTo: message.replyTo");
    expect(source).toContain("to: message.to");
  });
});
