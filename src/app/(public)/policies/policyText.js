/** Policy text is a plain string, or a rich value whose parts are text runs and in-site links. */

export function policyLink(href, label) {
  return { href, kind: "link", label };
}

export function richText(...parts) {
  return {
    kind: "rich",
    parts: parts.map((part) => (part.kind === "link" ? part : { kind: "text", text: part })),
  };
}

export function plainText(value) {
  if (value.kind !== "rich") {
    return value;
  }
  return value.parts.map((part) => (part.kind === "link" ? part.label : part.text)).join("");
}
