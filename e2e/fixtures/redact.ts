const SECRET_PATTERNS = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"],
  [/([?&](?:token|secret|key|code)=)[^&\s]+/gi, "$1[redacted]"],
  [/(authorization|cookie|set-cookie):\s*[^\r\n]+/gi, "$1: [redacted]"],
] as const;

export function redactE2eEvidence(value: string) {
  return SECRET_PATTERNS.reduce(
    (sanitized, [pattern, replacement]) => sanitized.replace(pattern, replacement),
    value
  );
}
