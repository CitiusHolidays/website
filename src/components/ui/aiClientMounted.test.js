import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ChatbotAnnouncement, ChatbotMessageList, ChatbotSuggestions } from "./ChatbotMessages";
import { CONCIERGE_TAB_HISTORY_POLICY, useChatbotConversation } from "./useChatbotConversation";

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
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.matchMedia = () => ({
    addEventListener() {
      // The fixture does not emit media-query changes.
    },
    matches: false,
    removeEventListener() {
      // The fixture has no media-query listener to remove.
    },
  });
  dom.window.matchMedia = globalThis.matchMedia;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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

function completedFetchCapture() {
  let requestCount = 0;
  return {
    fetchImpl() {
      requestCount += 1;
      const body = [
        { messageId: `server-${requestCount}`, type: "start" },
        { id: "text-1", type: "text-start" },
        { delta: `Answer ${requestCount}`, id: "text-1", type: "text-delta" },
        { finishReason: "stop", type: "finish" },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join("");
      return Promise.resolve(
        new Response(`${body}data: [DONE]\n\n`, {
          headers: { "Content-Type": "text/event-stream" },
          status: 200,
        })
      );
    },
    getRequestCount: () => requestCount,
  };
}

describe("Mounted AI clients", () => {
  test("explains tab storage, provider processing, redaction limits, and consent before sending", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(() => {
      root.render(React.createElement(ChatbotSuggestions, { onSelectPrompt: () => undefined }));
    });

    expect(CONCIERGE_TAB_HISTORY_POLICY).toEqual({
      maxMessages: 20,
      storage: "sessionStorage",
    });
    expect(container.textContent).toContain("up to 20 messages in browser session storage");
    expect(container.textContent).toContain("only the filtered copy goes to OpenRouter");
    expect(container.textContent).toContain("schedules it for deletion after 30 days");
    expect(container.textContent).toContain("filters can miss sensitive data");
    expect(container.textContent).toContain("separate handoff after you consent");

    await act(async () => root.unmount());
  });

  test("Growing streamed text keeps the same mounted part node", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(() => {
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

    await act(() => {
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
          onRegenerate: () => undefined,
          onRetry: () => undefined,
        })
      );
    await act(() => {
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

    await act(() => {
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
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === "Regenerate response"
      )
    ).toBe(true);

    await act(() => {
      root.render(
        renderChat({
          isActive: false,
          isLoading: false,
          messages: [assistantMessage("First and second", "complete")],
        })
      );
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
    await act(() => {
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
    await act(() => {
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
    await act(() => {
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
    await act(() => {
      failedRoot.render(
        renderChat({
          errorMessage: "Citius Concierge could not complete that response. Please try again.",
          isActive: false,
          isLoading: false,
          messages: [emptyCompletion],
        })
      );
    });
    await act(() => {
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
    await act(() => {
      conversation.setInput("Plan a retreat");
    });
    let pending;
    await act(async () => {
      pending = conversation.handleSubmit({ preventDefault: () => undefined });
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
      pending = conversation.handleSubmit({ preventDefault: () => undefined });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => root.unmount());
    expect(capture.getSignal().aborted).toBe(true);
    await pending;
  });

  test("browser request failures log only a fixed privacy-safe category", async () => {
    const sentinel = "traveller-private@example.test provider-body-sentinel";
    const logs = [];
    const originalConsoleError = console.error;
    console.error = (...args) => logs.push(args);
    globalThis.fetch = () => Promise.reject(new Error(sentinel));
    const container = document.createElement("div");
    const root = createRoot(container);
    let conversation;
    function Harness() {
      conversation = useChatbotConversation();
      return null;
    }

    try {
      await act(async () => root.render(React.createElement(Harness)));
      await act(async () => conversation.setInput("Plan a safe trip"));
      await act(async () => conversation.handleSubmit({ preventDefault: () => undefined }));

      expect(logs).toEqual([["Concierge request failed."]]);
      expect(JSON.stringify(logs)).not.toContain(sentinel);
    } finally {
      console.error = originalConsoleError;
      await act(async () => root.unmount());
    }
  });

  test("A completed answer can be regenerated without duplicating the user turn", async () => {
    const capture = completedFetchCapture();
    globalThis.fetch = capture.fetchImpl;
    const container = document.createElement("div");
    const root = createRoot(container);
    let conversation;
    function Harness() {
      conversation = useChatbotConversation();
      return null;
    }
    await act(async () => root.render(React.createElement(Harness)));
    await act(async () => conversation.setInput("Plan a leadership retreat"));
    await act(async () => conversation.handleSubmit({ preventDefault: () => undefined }));
    expect(capture.getRequestCount()).toBe(1);
    expect(conversation.messages).toHaveLength(2);

    await act(async () => conversation.regenerateLastResponse());

    expect(capture.getRequestCount()).toBe(2);
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages.at(-1).parts.at(-1).text).toBe("Answer 2");
    expect(sessionStorage.length).toBeGreaterThan(0);
    expect(localStorage.length).toBe(0);
    await act(async () => root.unmount());
  });
});
