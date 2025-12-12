import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits

/**
 * Get the encryption key from environment variables
 * In production, this should be a securely generated 32+ character string
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  // Use scrypt to derive a 32-byte key from the provided key
  // This ensures we always have the correct key length regardless of input
  const salt = Buffer.from('next-stock-salt-v1') // Static salt for deterministic key derivation
  return scryptSync(key, salt, 32)
}

export interface EncryptedData {
  iv: string
  encrypted: string
  tag: string
  version: number
}

/**
 * Encrypt a string value
 * @param plaintext - The string to encrypt
 * @returns Encrypted data object with iv, encrypted content, and auth tag
 */
export function encrypt(plaintext: string): EncryptedData {
  if (!plaintext) {
    return { iv: '', encrypted: '', tag: '', version: 1 }
  }

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    encrypted,
    tag: tag.toString('base64'),
    version: 1, // Version for future migration if algorithm changes
  }
}

/**
 * Decrypt an encrypted data object
 * @param encryptedData - The encrypted data object
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: EncryptedData): string {
  if (!encryptedData.encrypted) {
    return ''
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(encryptedData.iv, 'base64')
  const tag = Buffer.from(encryptedData.tag, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Check if a value is an encrypted data object
 */
export function isEncrypted(value: unknown): value is EncryptedData {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.iv === 'string' &&
    typeof obj.encrypted === 'string' &&
    typeof obj.tag === 'string' &&
    typeof obj.version === 'number'
  )
}

/**
 * Encrypt sensitive fields in an object
 * @param data - Object containing sensitive fields
 * @param sensitiveFields - Array of field names to encrypt
 * @returns Object with sensitive fields encrypted
 */
export function encryptSensitiveFields<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: (keyof T)[]
): T {
  const result = { ...data }

  for (const field of sensitiveFields) {
    const value = data[field]
    if (typeof value === 'string' && value) {
      (result as Record<string, unknown>)[field as string] = encrypt(value)
    }
  }

  return result
}

/**
 * Decrypt sensitive fields in an object
 * @param data - Object containing encrypted fields
 * @param sensitiveFields - Array of field names to decrypt
 * @returns Object with sensitive fields decrypted
 */
export function decryptSensitiveFields<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: (keyof T)[]
): T {
  const result = { ...data }

  for (const field of sensitiveFields) {
    const value = data[field]
    if (isEncrypted(value)) {
      (result as Record<string, unknown>)[field as string] = decrypt(value)
    }
  }

  return result
}

/**
 * Mask a sensitive string for display (show first few characters)
 * @param value - The string to mask
 * @param visibleChars - Number of characters to show at the start
 * @returns Masked string
 */
export function maskSecret(value: string, visibleChars: number = 8): string {
  if (!value) return ''
  if (value.length <= visibleChars) return '••••••••'
  return value.slice(0, visibleChars) + '••••••••'
}
