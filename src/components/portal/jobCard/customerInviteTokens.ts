/**
 * Customer app invite tokens are made in the staff browser (ADR 0020): 32 random bytes as
 * base64url, of which the server receives only the SHA-256 hex digest.
 */
const PADDING = /[=]+$/;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(PADDING, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function newInviteToken() {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { hash: await sha256Hex(token), token };
}
