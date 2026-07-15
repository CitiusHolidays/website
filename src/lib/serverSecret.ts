import { timingSafeEqual } from "node:crypto";

export function timingSafeSecretEqual(expected: string, received: string | null): boolean {
  if (!received) {
    return false;
  }

  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  if (expectedBytes.length !== receivedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, receivedBytes);
}
