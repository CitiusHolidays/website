import { describe, expect, test } from "bun:test";
import { renderContactFormEmail } from "./renderContactEmail";

const base = {
  email: "traveller@example.com",
  message: "Please help plan a private journey.",
  name: "A Traveller",
  receivedAtMs: Date.UTC(2026, 6, 14, 12, 0, 0),
  subject: "Private journey",
};

describe("contact email rendering", () => {
  test("renders the complete table-based transactional layout without emoji", async () => {
    const html = await renderContactFormEmail({ ...base, phone: "+1 555-123-4567" });
    expect(html).toContain('role="presentation"');
    expect(html).toContain("New Contact Form Submission");
    expect(html).toContain("Citius Holidays website");
    expect(html).toContain("+1 555-123-4567");
    expect(html).not.toMatch(/[📧👤📞📋💬]/u);
    expect(html).not.toContain("class=");
  });

  test("omits the optional phone row for a minimal submission", async () => {
    const html = await renderContactFormEmail(base);
    expect(html).not.toContain(">Phone<");
    expect(html).toContain("traveller@example.com");
  });

  test("preserves a long message without depending on images or external fonts", async () => {
    const message = "Travel details ".repeat(250);
    const html = await renderContactFormEmail({ ...base, message });
    expect(html).toContain(message.trim());
    expect(html).not.toContain("<img");
    expect(html).not.toContain("@font-face");
  });

  test("escapes hostile submitted fields", async () => {
    const html = await renderContactFormEmail({
      ...base,
      message: '<script>alert("message")</script>',
      name: '<img src=x onerror="alert(1)">',
      subject: "<b>urgent</b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>urgent</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;urgent&lt;/b&gt;");
  });
});
