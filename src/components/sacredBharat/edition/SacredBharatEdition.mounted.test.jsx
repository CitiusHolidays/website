import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { SACRED_BHARAT_EDITION_001 } from "@/data/sacredBharat/edition001";
import { isRuntimeObject, isRuntimeString } from "@/lib/runtimeValues";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://www.citiusholidays.com/sacred-bharat?via=0123456789abcdef0123456789abcdef",
});
let createRoot;
let SacredBharatEdition;
const sendBeacon = mock(() => true);
const fetchRequest = mock(() => Promise.resolve(new Response(null, { status: 202 })));
const clipboardWriteText = mock(() => Promise.resolve());
const createObjectURL = mock(() => "blob:sacred-bharat-story");
const revokeObjectURL = mock(() => undefined);
const anchorClick = mock(() => undefined);
const createStoryCardBlob = mock(() => Promise.resolve(storyCardBlob()));
const ANSWER_BEARING_CLUE_TERMS =
  /Varanasi|Ganga|Harmandir|Amritsar|Amrit Sarovar|Golden Temple|Meenakshi|Madurai|Golden Lotus|Kedarnath|Konark|Sun Temple|Surya/i;

function storyCardBlob() {
  return new Blob(["story-card"], { type: "image/png" });
}

function assetSource(source) {
  if (isRuntimeString(source)) {
    return source;
  }
  return isRuntimeObject(source) && "src" in source && isRuntimeString(source.src)
    ? source.src
    : "";
}

function linkTarget(href) {
  if (isRuntimeString(href)) {
    return href;
  }
  return isRuntimeObject(href) && "pathname" in href && isRuntimeString(href.pathname)
    ? href.pathname
    : "";
}

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.File = dom.window.File;
  dom.window.matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: String(query).includes("prefers-reduced-motion"),
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = dom.window.matchMedia;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.fetch = fetchRequest;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis.navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon,
  });
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWriteText },
  });
  Object.defineProperty(globalThis.navigator, "share", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis.URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
  Object.defineProperty(dom.window.HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: anchorClick,
  });
  mock.module("next/image", () => ({
    default: ({ alt, src }) => <span aria-label={alt} data-src={assetSource(src)} role="img" />,
  }));
  mock.module("next/link", () => ({
    default: ({ children, href, ...props }) => (
      <a href={linkTarget(href)} {...props}>
        {children}
      </a>
    ),
  }));
  mock.module("@/lib/sacredBharat/storyCard", () => ({ createStoryCardBlob }));
  ({ createRoot } = await import("react-dom/client"));
  ({ default: SacredBharatEdition } = await import("./SacredBharatEdition"));
});

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  sendBeacon.mockReset();
  sendBeacon.mockImplementation(() => true);
  fetchRequest.mockReset();
  fetchRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 202 })));
  clipboardWriteText.mockReset();
  clipboardWriteText.mockImplementation(() => Promise.resolve());
  createStoryCardBlob.mockReset();
  createStoryCardBlob.mockImplementation(() => Promise.resolve(storyCardBlob()));
  createObjectURL.mockReset();
  createObjectURL.mockImplementation(() => "blob:sacred-bharat-story");
  revokeObjectURL.mockReset();
  revokeObjectURL.mockImplementation(() => undefined);
  anchorClick.mockReset();
  anchorClick.mockImplementation(() => undefined);
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

function buttonWithText(container, text) {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text)
  );
}

function questionImage(container, question) {
  return [...container.querySelectorAll('[role="img"]')].find(
    (image) => image.getAttribute("data-src") === question.image && image.getAttribute("aria-label")
  );
}

async function answerQuestion(container, question, nextLabel) {
  const answer = question.choices.find((choice) => choice.id === question.answer)?.label;
  expect(question.clueAlt).not.toMatch(ANSWER_BEARING_CLUE_TERMS);
  expect(questionImage(container, question)?.getAttribute("aria-label")).toBe(question.clueAlt);

  await act(async () => buttonWithText(container, answer)?.click());
  expect(container.textContent).toContain("Recognised");
  expect(questionImage(container, question)?.getAttribute("aria-label")).toBe(question.imageAlt);
  await act(async () => buttonWithText(container, nextLabel)?.click());
}

async function mountEdition() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<SacredBharatEdition />));
  return { container, root };
}

async function completeEdition(container, index = 0) {
  const question = SACRED_BHARAT_EDITION_001.questions[index];
  if (!question) {
    return;
  }
  const nextLabel =
    index === SACRED_BHARAT_EDITION_001.questions.length - 1 ? "See my result" : "Next detail";
  await answerQuestion(container, question, nextLabel);
  await completeEdition(container, index + 1);
}

function recordedEventCount(event) {
  return fetchRequest.mock.calls.filter(([, init]) => JSON.parse(init.body).event === event).length;
}

function deferred() {
  let reject;
  let resolve;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe("Mounted Sacred Bharat edition flow", () => {
  test("starts on the first visual detail and completes without login or a landing gate", async () => {
    const { container, root } = await mountEdition();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [eventUrl, eventBody] = sendBeacon.mock.calls[0];
    expect(eventUrl).toBe("/api/sacred-bharat/events");
    expect(JSON.parse(await eventBody.text())).toMatchObject({
      edition: "001",
      event: "edition_started",
      referrerToken: "0123456789abcdef0123456789abcdef",
    });

    expect(container.textContent).toContain("Which river city wakes like this?");
    expect(container.textContent).toContain("No login");
    expect(container.textContent).not.toContain("Start challenge");
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);

    await completeEdition(container);

    expect(container.textContent).toContain("5/5");
    expect(container.textContent).toContain("Every detail");
    const recap = container.querySelector('section[aria-labelledby="sacred-result-recap"]');
    expect(recap?.querySelectorAll("li")).toHaveLength(5);
    expect(recap?.textContent).toContain("Recognised: Varanasi, Uttar Pradesh");
    expect(recap?.textContent).toContain("Recognised: Sri Harmandir Sahib, Amritsar");
    expect(recap?.textContent).toContain("24 carved wheels");
    expect(container.textContent).toContain("Choose your Story treatment");
    expect(container.textContent).toContain("Midnight archive");
    expect(container.textContent).toContain("Temple red");
    expect(container.textContent).toContain("Monsoon green");
    expect(container.textContent).toContain("Invite a friend");
    expect(container.querySelector('a[href="/pilgrimage"]')?.textContent).toContain(
      "Explore pilgrimage routes"
    );

    await act(async () => root.unmount());
    container.remove();
  });

  test("keeps share, download, and copy effects single-flight under rapid activation", async () => {
    const { container, root } = await mountEdition();
    await completeEdition(container);

    await act(async () => buttonWithText(container, "Temple red")?.click());
    const shareCard = deferred();
    createStoryCardBlob.mockImplementationOnce(() => shareCard.promise);
    const shareButton = buttonWithText(container, "Invite a friend");
    await act(async () => {
      shareButton?.click();
      shareButton?.click();
      await Promise.resolve();
    });
    expect(createStoryCardBlob).toHaveBeenCalledTimes(1);
    expect(createStoryCardBlob.mock.calls[0][0].style.id).toBe("temple-red");
    expect(shareButton?.disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Preparing your edition to share"
    );
    await act(async () => {
      shareCard.resolve(storyCardBlob());
      await Promise.resolve();
    });
    expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    expect(recordedEventCount("share_clicked")).toBe(1);

    const downloadCard = deferred();
    createStoryCardBlob.mockImplementationOnce(() => downloadCard.promise);
    const downloadButton = buttonWithText(container, "Download");
    await act(async () => {
      downloadButton?.click();
      downloadButton?.click();
      await Promise.resolve();
    });
    expect(createStoryCardBlob).toHaveBeenCalledTimes(2);
    expect(downloadButton?.disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Creating your Story card for download"
    );
    await act(async () => {
      downloadCard.resolve(storyCardBlob());
      await Promise.resolve();
    });
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(recordedEventCount("result_downloaded")).toBe(1);

    const copyWrite = deferred();
    clipboardWriteText.mockImplementationOnce(() => copyWrite.promise);
    const copyButton = buttonWithText(container, "Copy link");
    await act(async () => {
      copyButton?.click();
      copyButton?.click();
      await Promise.resolve();
    });
    expect(clipboardWriteText).toHaveBeenCalledTimes(2);
    expect(copyButton?.disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Copying your share link"
    );
    await act(async () => {
      copyWrite.resolve();
      await Promise.resolve();
    });
    expect(recordedEventCount("share_link_copied")).toBe(1);
    expect(copyButton?.disabled).toBe(false);

    await act(async () => root.unmount());
    container.remove();
  });

  test("names a failed share and keeps the visible copy recovery available", async () => {
    const { container, root } = await mountEdition();
    await completeEdition(container);

    createStoryCardBlob.mockImplementationOnce(() => Promise.reject(new Error("canvas failed")));
    const shareButton = buttonWithText(container, "Invite a friend");
    await act(async () => {
      shareButton?.click();
      await Promise.resolve();
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toBe("Sharing failed. Try Copy link or Download instead.");
    expect(status?.textContent).not.toContain("canvas failed");
    expect(shareButton?.disabled).toBe(false);
    expect(recordedEventCount("share_clicked")).toBe(0);

    const copyButton = buttonWithText(container, "Copy link");
    await act(async () => {
      copyButton?.click();
      await Promise.resolve();
    });
    expect(status?.textContent).toBe("Share link copied.");
    expect(recordedEventCount("share_link_copied")).toBe(1);

    await act(async () => root.unmount());
    container.remove();
  });
});
