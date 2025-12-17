/**
 * Encryption Utilities for Sensitive Data
 * 
 * Uses AES-256-GCM for encrypting sensitive user data like passport details.
 * This provides authenticated encryption with data integrity verification.
 * 
 * IMPORTANT: Store the ENCRYPTION_KEY securely and never commit it to version control.
 * The key should be a 32-byte (256-bit) random string, base64 encoded.
 * 
 * Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // For key derivation

/**
 * Get the encryption key from environment
 * @returns {Buffer} The encryption key
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY not configured. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  
  return Buffer.from(key, 'base64');
}

/**
 * Encrypt sensitive data
 * 
 * @param {Object|string} data - Data to encrypt (will be JSON stringified if object)
 * @returns {string} Encrypted data as base64 string (iv:authTag:ciphertext)
 */
export function encrypt(data) {
  const key = getEncryptionKey();
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  // Encrypt the data
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * 
 * @param {string} encryptedData - Encrypted data in format iv:authTag:ciphertext
 * @param {boolean} parseJson - Whether to parse the result as JSON (default: true)
 * @returns {Object|string} Decrypted data
 */
export function decrypt(encryptedData, parseJson = true) {
  if (!encryptedData) {
    return null;
  }
  
  const key = getEncryptionKey();
  
  // Split the components
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivBase64, authTagBase64, ciphertext] = parts;
  
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  // Set the auth tag
  decipher.setAuthTag(authTag);
  
  // Decrypt the data
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return parseJson ? JSON.parse(decrypted) : decrypted;
}

/**
 * Hash sensitive data (one-way, for lookups)
 * Use this for data you need to search but not decrypt
 * 
 * @param {string} data - Data to hash
 * @returns {string} SHA-256 hash of the data
 */
export function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypt passport details for storage
 * 
 * @param {Object} passportDetails
 * @param {string} passportDetails.number - Passport number
 * @param {string} passportDetails.expiryDate - Passport expiry date
 * @param {string} passportDetails.nationality - Nationality
 * @param {string} passportDetails.dateOfBirth - Date of birth
 * @returns {string} Encrypted passport details
 */
export function encryptPassportDetails(passportDetails) {
  // Validate required fields
  const required = ['number', 'expiryDate', 'nationality', 'dateOfBirth'];
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
    encryptedAt: new Date().toISOString(),
  });
}

/**
 * Decrypt passport details
 * 
 * @param {string} encryptedDetails - Encrypted passport details
 * @returns {Object} Decrypted passport details
 */
export function decryptPassportDetails(encryptedDetails) {
  return decrypt(encryptedDetails, true);
}











