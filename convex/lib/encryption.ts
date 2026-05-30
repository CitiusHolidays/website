"use node";

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not configured. Base64 string required.",
    );
  }
  return Buffer.from(key, "base64");
}

export function encrypt(data: string | object): string {
  const key = getEncryptionKey();
  const plaintext = typeof data === "string" ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

export function decrypt(encryptedData: string, parseJson = true): any {
  if (!encryptedData) {
    return null;
  }
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  const [ivBase64, authTagBase64, ciphertext] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return parseJson ? JSON.parse(decrypted) : decrypted;
}

export function encryptBuffer(buffer: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(combinedBuffer: Buffer): Buffer {
  const key = getEncryptionKey();
  if (combinedBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted buffer length");
  }
  const iv = combinedBuffer.subarray(0, IV_LENGTH);
  const authTag = combinedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combinedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function hash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export interface PassportDetailsPayload {
  number: string;
  expiryDate: string;
  nationality: string;
  dateOfBirth: string;
  issueDate?: string;
}

export function encryptPassportDetails(passportDetails: PassportDetailsPayload): string {
  const required: Array<keyof PassportDetailsPayload> = [
    "number",
    "expiryDate",
    "nationality",
    "dateOfBirth",
  ];
  for (const field of required) {
    if (!passportDetails[field]) {
      throw new Error(`Passport ${field} is required`);
    }
  }
  return encrypt({
    number: passportDetails.number,
    expiryDate: passportDetails.expiryDate,
    nationality: passportDetails.nationality,
    dateOfBirth: passportDetails.dateOfBirth,
    issueDate: passportDetails.issueDate ?? "",
    encryptedAt: new Date().toISOString(),
  });
}

export function decryptPassportDetails(
  encryptedDetails: string,
): PassportDetailsPayload & { encryptedAt: string; issueDate?: string } {
  return decrypt(encryptedDetails, true);
}
