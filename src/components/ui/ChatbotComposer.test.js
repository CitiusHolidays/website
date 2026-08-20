import { describe, expect, test } from "bun:test";
import { shouldSubmitChatKey } from "./ChatbotComposer";

describe("Concierge composer keyboard behavior", () => {
  test("sends on Enter but not while composing text or requesting a new line", () => {
    expect(shouldSubmitChatKey({ key: "Enter", shiftKey: false })).toBe(true);
    expect(shouldSubmitChatKey({ isComposing: true, key: "Enter", shiftKey: false })).toBe(false);
    expect(
      shouldSubmitChatKey({
        key: "Enter",
        nativeEvent: { isComposing: true },
        shiftKey: false,
      })
    ).toBe(false);
    expect(shouldSubmitChatKey({ key: "Enter", shiftKey: true })).toBe(false);
  });
});
