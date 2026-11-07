/**
 * The customer app's sign-in request is checked and sent in the background (ADR 0020). Its
 * scheduled arguments (address, link token, device and invite digests) are sealed with AES-GCM
 * under a key derived from the auth secret, so the scheduler's records never hold them readable.
 */
export interface SignInRequestPayload {
  deviceDigest: string | null;
  email: string;
  inviteTokenHash: string | null;
  token: string;
}

const KEY_LABEL = "citius-customer-app-sign-in-request-v1";
const IV_BYTES = 12;

async function sealKey(secret: string) {
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
  }
  const material = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${KEY_LABEL}:${secret}`)
  );
  return await globalThis.crypto.subtle.importKey("raw", material, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function sealSignInRequest(payload: SignInRequestPayload, secret: string) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await globalThis.crypto.subtle.encrypt(
    { iv, name: "AES-GCM" },
    await sealKey(secret),
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`;
}

export async function openSignInRequest(
  sealed: string,
  secret: string
): Promise<SignInRequestPayload> {
  const [iv, body] = sealed.split(".");
  const plain = await globalThis.crypto.subtle.decrypt(
    { iv: fromBase64(iv ?? ""), name: "AES-GCM" },
    await sealKey(secret),
    fromBase64(body ?? "")
  );
  const payload: SignInRequestPayload = JSON.parse(new TextDecoder().decode(plain));
  return payload;
}
