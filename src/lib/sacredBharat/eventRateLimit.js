function hex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sacredBharatEventRateLimitKey(clientIp, gatewaySecret) {
  const source = new TextEncoder().encode(`${gatewaySecret}\0${clientIp}`);
  return hex(await globalThis.crypto.subtle.digest("SHA-256", source));
}
