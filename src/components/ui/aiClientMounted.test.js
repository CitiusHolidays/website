import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JourneyPlanResponse } from "@/components/sacredBharat/JourneyPlannerPanel";
import { ChatbotMessageList } from "./ChatbotMessages";
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

describe("mounted AI clients", () => {
  test("growing streamed text keeps the same mounted part node", async () => {
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
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("Recommended journey");
    await act(async () => root.unmount());
  });

  test("visible cancellation preserves partial output with a cancelled terminal state", async () => {
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

  test("component unmount aborts an active request", async () => {
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
