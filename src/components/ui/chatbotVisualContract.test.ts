import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const chatbotSources = ["Chatbot.js", "ChatbotMessages.js", "ChatbotWindow.js"].map((file) =>
  readFileSync(resolve(import.meta.dir, file), "utf8")
);
const designAuthority = readFileSync(resolve(root, "DESIGN.md"), "utf8");
const EYEBROW_CLASS_PATTERN = /uppercase[^"\n]*tracking|tracking[^"\n]*uppercase/;

describe("Concierge visual authority", () => {
  test("uses the configured typography roles without eyebrow treatments", () => {
    for (const source of chatbotSources) {
      expect(source).not.toContain("font-serif");
      expect(source).not.toMatch(EYEBROW_CLASS_PATTERN);
    }
  });

  test("records the durable no-eyebrow and no-font-change decisions", () => {
    expect(designAuthority).toContain("Do not use eyebrow or overline text");
    expect(designAuthority).toContain("Do not add, replace, or change fonts");
  });
});
