import { describe, expect, test } from "bun:test";
import { boundStoredMessages } from "./useChatbotConversation";

describe("chat history persistence bounds", () => {
  test("keeps only the most recent messages and caps part text", () => {
    const messages = Array.from({ length: 24 }, (_, index) => ({
      id: `message-${index}`,
      parts: [{ id: `part-${index}`, text: "x".repeat(100), type: "text" }],
      role: index % 2 === 0 ? "user" : "assistant",
    }));

    const bounded = boundStoredMessages(messages);

    expect(bounded).toHaveLength(20);
    expect(bounded[0]?.id).toBe("message-4");
    expect(bounded.at(-1)?.id).toBe("message-23");
    expect(bounded.every((message) => message.parts[0].text.length <= 8000)).toBe(true);
    expect(JSON.stringify(bounded).length).toBeLessThanOrEqual(96_000);

    const longMessage = boundStoredMessages([
      {
        id: "long-message",
        parts: [{ id: "long-part", text: "x".repeat(12_000), type: "text" }],
        role: "assistant",
      },
    ]);
    expect(longMessage[0]?.parts[0].text).toHaveLength(8000);
  });
});
