import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JourneyPlanResponse } from "@/components/sacredBharat/JourneyPlannerPanel";
import { ChatbotAnnouncement, ChatbotMessageList } from "./ChatbotMessages";
import { useChatbotConversation } from "./useChatbotConversation";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com",
});
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  dom.window.close();
});

function assistantMessage(text, terminalState = "generating") {
  return {
    id: "assistant-1",
    parts: [{ id: "text-1", text, type: "text" }],
    requestId: "assistant-1",
    role: "assistant",
    terminalState,
  };
}

function streamingFetchCapture() {
  let capturedSignal;
  const fetchImpl = (_url, options) => {
    capturedSignal = options.signal;
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            'data: {"messageId":"server-1","type":"start"}\n\n' +
              'data: {"id":"text-1","type":"text-start"}\n\n' +
              'data: {"delta":"Partial answer","id":"text-1","type":"text-delta"}\n\n'
          )
        );
        options.signal.addEventListener(
          "abort",
          () => controller.error(new DOMException("aborted", "AbortError")),
          { once: true }
        );
      },
    });
    return Promise.resolve(
      new Response(stream, {
        headers: { "Content-Type": "text/event-stream" },
        status: 200,
      })
    );
  };
  return { fetchImpl, getSignal: () => capturedSignal };
}

describe("Mounted AI clients", () => {
  test("Growing streamed text keeps the same mounted part node", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(ChatbotMessageList, {
          errorMessage: "",
          isLoading: true,
          messages: [assistantMessage("First")],
          onRetry: () => undefined,
        })
      );
    });
    const firstNode = container.querySelector(".chatbot-formatted");

    await act(async () => {
      root.render(
        React.createElement(ChatbotMessageList, {
          errorMessage: "",
          isLoading: true,
          messages: [assistantMessage("First and second")],
          onRetry: () => undefined,
        })
      );
    });
    expect(container.querySelector(".chatbot-formatted")).toBe(firstNode);
    await act(async () => root.unmount());
  });

  test("Chat messages use one stable announcement owner without streaming token chatter", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const announcedTerminalKeys = { current: new Set() };
    const renderChat = ({ errorMessage = "", isActive = true, isLoading, messages }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ChatbotAnnouncement, {
          announcedTerminalKeys,
          errorMessage,
          isActive,
          isLoading,
          messages,
        }),
        React.createElement(ChatbotMessageList, {
          errorMessage,
          isLoading,
          messages,
          onRetry: () => undefined,
        })
      );
    await act(async () => {
      root.render(
        renderChat({
          isLoading: true,
          messages: [
            {
              ...assistantMessage("First"),
              parts: [
                { id: "reasoning-1", status: "working", type: "reasoning" },
                { id: "text-1", text: "First", type: "text" },
              ],
            },
          ],
        })
      );
    });

    const log = container.querySelector('[role="log"]');
    expect(log?.getAttribute("aria-live")).toBe("off");
    expect(log?.getAttribute("aria-label")).toBe("Citius Concierge conversation");
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Citius Concierge is preparing a response."
    );

    await act(async () => {
      root.render(
        renderChat({
          isLoading: false,
          messages: [assistantMessage("First and second", "complete")],
        })
      );
    });
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Citius Concierge response 1: First and second"
    );

    await act(async () => {
      root.render(
        renderChat({
          isActive: false,
          isLoading: false,
          messages: [assistantMessage("First and second", "complete")],
        })
      );
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
    await act(async () => {
      root.render(
        renderChat({
          isLoading: false,
          messages: [assistantMessage("First and second", "complete")],
        })
      );
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
    await act(async () => root.unmount());

    const reopenedRoot = createRoot(container);
    await act(async () => {
      reopenedRoot.render(
        renderChat({
          isLoading: false,
          messages: [assistantMessage("First and second", "complete")],
        })
      );
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
    await act(async () => reopenedRoot.unmount());

    const emptyCompletion = {
      ...assistantMessage("", "complete"),
      id: "assistant-empty",
      parts: [],
    };
    const failedRoot = createRoot(container);
    await act(async () => {
      failedRoot.render(
        renderChat({
          errorMessage: "Citius Concierge could not complete that response. Please try again.",
          isLoading: false,
          messages: [emptyCompletion],
        })
      );
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Citius Concierge response could not be completed."
    );
    await act(async () => {
      failedRoot.render(
        renderChat({
          errorMessage: "Citius Concierge could not complete that response. Please try again.",
          isActive: false,
          isLoading: false,
          messages: [emptyCompletion],
        })
      );
    });
    await act(async () => {
      failedRoot.render(
        renderChat({
          errorMessage: "Citius Concierge could not complete that response. Please try again.",
          isLoading: false,
          messages: [emptyCompletion],
        })
      );
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
    await act(async () => failedRoot.unmount());
  });

  test("Journey Planner formatted output does not mount unsafe HTML", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const message = assistantMessage(
      "## Recommended journey\n<script>window.__unsafe = true</script>\nVisit Kashi.",
      "complete"
    );
    await act(async () => {
      root.render(React.createElement(JourneyPlanResponse, { message }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("Recommended journey");
    await act(async () => root.unmount());
  });

  test("Visible cancellation preserves partial output with a cancelled terminal state", async () => {
    const capture = streamingFetchCapture();
    globalThis.fetch = capture.fetchImpl;
    const container = document.createElement("div");
    const root = createRoot(container);
    let conversation;
    function Harness() {
      conversation = useChatbotConversation();
      return null;
    }
    await act(async () => root.render(React.createElement(Harness)));
    await act(async () => {
      conversation.setInput("Plan a retreat");
    });
    let pending;
    await act(async () => {
      pending = conversation.handleSubmit({ preventDefault() {} });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(capture.getSignal().aborted).toBe(false);
    await act(async () => {
      conversation.cancelActiveRequest();
      await pending;
    });
    const assistant = conversation.messages.at(-1);
    expect(assistant.terminalState).toBe("cancelled");
    expect(assistant.parts.find((part) => part.type === "text")?.text).toBe("Partial answer");
    await act(async () => root.unmount());
  });

  test("Component unmount aborts an active request", async () => {
    const capture = streamingFetchCapture();
    globalThis.fetch = capture.fetchImpl;
    const container = document.createElement("div");
    const root = createRoot(container);
    let conversation;
    function Harness() {
      conversation = useChatbotConversation();
      return null;
    }
    await act(async () => root.render(React.createElement(Harness)));
    await act(async () => conversation.setInput("Plan another retreat"));
    let pending;
    await act(async () => {
      pending = conversation.handleSubmit({ preventDefault() {} });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => root.unmount());
    expect(capture.getSignal().aborted).toBe(true);
    await pending;
  });
});
