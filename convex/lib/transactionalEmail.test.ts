import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { prepareAuthEmailMessage } from "./authEmailHtml";
import {
  EMAIL_BRAND_LOGO_URL,
  renderTransactionalEmail,
  type TransactionalEmailContent,
} from "./transactionalEmail";

const QUERY_TEXT_ROW = /Query\s+Q-0264/;
const PAX_TEXT_ROW = /Pax\s+0/;

const base: TransactionalEmailContent = {
  action: {
    href: "https://citius.example/portal/queries?open=query&id=sample&from=email",
    label: "Open the query",
  },
  context: "Citius Connect · Staff workspace",
  details: {
    rows: [
      { label: "Query", value: "Q-0264" },
      { label: "Optional", value: "" },
      { label: "Pax", value: "0" },
    ],
    title: "Query details",
  },
  footer: "Sent to the staff selected for this workflow update.",
  paragraphs: ["Review the assigned work before taking action."],
  title: "Contracting assignment",
};

describe("shared transactional email", () => {
  test("keeps the event, details and complete action in HTML and meaningful plain text", async () => {
    const { html, text } = await renderTransactionalEmail(base);
    const dom = new JSDOM(html);
    expect(dom.window.document.querySelector("h1")?.textContent).toBe(base.title);
    const links = [...dom.window.document.querySelectorAll("a")];
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      base.action.href,
      base.action.href,
    ]);
    expect(text).toContain(base.title);
    expect(text).toMatch(QUERY_TEXT_ROW);
    expect(text).toMatch(PAX_TEXT_ROW);
    expect(text).toContain(base.action.href);
    expect(text).toContain("Pax");
    expect(text).not.toContain("Optional");
    const images = [...dom.window.document.querySelectorAll("img")];
    expect(images.map((image) => image.src)).toEqual([EMAIL_BRAND_LOGO_URL]);
    expect(images[0]?.alt).toBe("Citius Holidays");
    expect(images[0]?.width).toBe(140);
    expect(images[0]?.height).toBe(50);
    expect(new URL(EMAIL_BRAND_LOGO_URL).search).toBe("");
    expect(html).not.toContain("@font-face");
    dom.window.close();
  });

  test("renders repeated preparation identically so retries can retain the frozen message", async () => {
    expect(await renderTransactionalEmail(base)).toEqual(await renderTransactionalEmail(base));
  });

  test("keeps token URLs in both action targets and plain text without displaying the token in HTML copy", async () => {
    const href =
      "https://citius.example/auth/email-verified?token=private-token&callbackURL=%2Faccount";
    const { html, text } = await renderTransactionalEmail({
      ...base,
      action: { href, label: "Verify email" },
    });
    const dom = new JSDOM(html);
    expect([...dom.window.document.querySelectorAll("a")].map((link) => link.href)).toEqual([
      href,
      href,
    ]);
    expect(dom.window.document.body.textContent).not.toContain("private-token");
    expect(text).toContain(href);
    dom.window.close();
  });

  test("a reply action has one mail link and no browser-link fallback", async () => {
    const href = "mailto:morgan%40cedar.example";
    const { html, text } = await renderTransactionalEmail({
      ...base,
      action: { href, label: "Reply to enquiry" },
    });
    const dom = new JSDOM(html);
    expect([...dom.window.document.querySelectorAll("a")].map((link) => link.href)).toEqual([href]);
    expect(dom.window.document.body.textContent).not.toContain("use the direct link");
    expect(text).toContain("morgan%40cedar.example");
    dom.window.close();
  });

  test("escapes all supplied content and omits an empty optional details section", async () => {
    const { html, text } = await renderTransactionalEmail({
      ...base,
      details: null,
      greeting: '<img src=x onerror="bad()">',
      paragraphs: ["<script>not executable</script>"],
      title: "A <query> & its update",
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("Query details");
    expect(text).toContain("A <query> & its update");
  });

  test.each([
    "javascript:alert(1)",
    "data:text/html,bad",
    "//example.com",
    "https://user:password@example.com",
    "https://example.com/\r\nbad",
    "mailto:person@example.com?body=unexpected",
    "mailto:person%0A@example.com",
  ])("rejects unsafe action URL %s", async (href) => {
    await expect(
      renderTransactionalEmail({ ...base, action: { ...base.action, href } })
    ).rejects.toThrow();
  });

  test.each(["password_reset", "verification"] as const)(
    "authentication %s retains its subject and exact secure link",
    async (purpose) => {
      const href = `http://localhost:3000/auth/${purpose}?token=synthetic-token&callbackURL=%2Faccount`;
      const message = await prepareAuthEmailMessage({
        ctaHref: href,
        greetingName: "Aria <Test>",
        purpose,
      });
      expect(message.subject).toBe(
        purpose === "password_reset"
          ? "Reset your Citius Holidays password"
          : "Verify your Citius Holidays account"
      );
      expect(message.text).toContain(href);
      expect(message.html).toContain("Aria &lt;Test&gt;");
      const dom = new JSDOM(message.html);
      expect(
        [...dom.window.document.querySelectorAll("a")].map((link) => link.getAttribute("href"))
      ).toEqual([href, href]);
      dom.window.close();
    }
  );
});
