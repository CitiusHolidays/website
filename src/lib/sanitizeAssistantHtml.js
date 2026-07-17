import DOMPurify from "isomorphic-dompurify";

/** Sanitize assistant HTML to AGENTS.md allowlist before render. */
const ALLOWED_TAGS = ["p", "h3", "ul", "ol", "li", "strong", "b", "em", "i", "br"];

export function sanitizeAssistantHtml(html) {
  const text = String(html ?? "");
  if (!text.trim()) {
    return "";
  }
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
