import createDOMPurify from "dompurify";

/** Sanitize assistant HTML to AGENTS.md allowlist before render. */
const ALLOWED_TAGS = ["p", "h3", "ul", "ol", "li", "strong", "b", "em", "i", "br"];
const SANITIZE_OPTIONS = {
  ALLOWED_ATTR: [],
  ALLOWED_TAGS,
};

let browserPurifier;
let browserPurifierWindow;

function getBrowserPurifier() {
  if (!("window" in globalThis)) {
    return null;
  }
  if (!browserPurifier || browserPurifierWindow !== globalThis.window) {
    const purifier = createDOMPurify(globalThis.window);
    if (!purifier.isSupported) {
      return null;
    }
    browserPurifier = purifier;
    browserPurifierWindow = globalThis.window;
  }
  return browserPurifier;
}

export function sanitizeAssistantHtml(html) {
  const text = String(html ?? "");
  if (!text.trim()) {
    return "";
  }
  const purifier = getBrowserPurifier();
  if (!purifier) {
    return "";
  }
  return purifier.sanitize(text, SANITIZE_OPTIONS);
}
