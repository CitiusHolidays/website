const ALGORITHM = "AES-GCM";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/** Convex tsc expects ArrayBuffer-backed views for Web Crypto BufferSource. */
function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getEncryptionKeyBytes(): Uint8Array<ArrayBuffer> | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    return null;
  }
  return base64ToBytes(key);
}

async function importAesKey(keyBytes: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey("raw", keyBytes, { name: ALGORITHM, length: 256 }, false, [
    "decrypt",
  ]);
}

/** Decrypt passport JSON payloads in query/mutation runtime (matches convex/lib/encryption.ts). */
export async function decryptPassportPayloadJson(
  encryptedData: string,
): Promise<Record<string, string> | null> {
  if (!encryptedData || !globalThis.crypto?.subtle) {
    return null;
  }

  const keyBytes = getEncryptionKeyBytes();
  if (!keyBytes) {
    return null;
  }

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    return null;
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = base64ToBytes(ivBase64);
  const authTag = base64ToBytes(authTagBase64);
  const ciphertext = base64ToBytes(ciphertextBase64);
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    return null;
  }

  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);
  const ivSource = toBufferSource(iv);
  const combinedSource = toBufferSource(combined);

  try {
    const cryptoKey = await importAesKey(keyBytes);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: ivSource },
      cryptoKey,
      combinedSource,
    );
    const text = new TextDecoder().decode(decrypted);
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : null;
  } catch {
    return null;
  }
}
