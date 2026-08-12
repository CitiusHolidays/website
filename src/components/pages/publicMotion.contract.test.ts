import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("public hero and Concierge motion", () => {
  test("uses a compositor transform for hero scroll and delegates chat exit ownership to Dialog", () => {
    const hero = readFileSync("src/components/pages/HomeHeroClient.js", "utf8");
    const chatbot = readFileSync("src/components/ui/ChatbotWindow.js", "utf8");

    expect(hero).toContain('"translate3d(0, 0%, 0)"');
    expect(hero).toContain("style={{ opacity, transform }}");
    expect(hero).not.toContain("style={{ opacity, y }}");
    expect(chatbot).toContain("<ControlledDialog");
    expect(chatbot).toContain("data-[ending-style]:scale-95");
    expect(chatbot).toContain("triggerless");
    expect(chatbot).not.toContain("if (!isOpen) {\n    return null");
  });
});
