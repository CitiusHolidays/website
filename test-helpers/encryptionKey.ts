/** Deterministic ENCRYPTION_KEY for import/passport contract tests — not for production. */
export const TEST_ENCRYPTION_KEY = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";

export async function withTestEncryptionKey<T>(fn: () => T | Promise<T>): Promise<T> {
  const previousKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  try {
    return await fn();
  } finally {
    if (previousKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = previousKey;
    }
  }
}

export function withTestEncryptionKeySync<T>(fn: () => T): T {
  const previousKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  try {
    return fn();
  } finally {
    if (previousKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = previousKey;
    }
  }
}
