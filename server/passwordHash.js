import crypto from "crypto";
import bcrypt from "bcryptjs";

/** Work factor for bcrypt; OWASP suggests >= 10 for interactive logins. */
const BCRYPT_COST = 12;

/**
 * Hash a password for storage (bcrypt).
 * @param {string} plain
 */
export function hashPasswordForStorage(plain) {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

function verifyLegacyScrypt(plain, storedHash) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  /* Legacy `scrypt:` rows only; verifying with the same parameters used when they were stored.
     New passwords use bcrypt. */
  const submittedHash = crypto.scryptSync(plain, salt, 64); // lgtm[js/insufficient-password-hash]
  const storedBuffer = Buffer.from(hash, "hex");
  return storedBuffer.length === submittedHash.length && crypto.timingSafeEqual(storedBuffer, submittedHash);
}

/**
 * Verify a password against the stored value. Supports legacy `scrypt:` rows
 * and bcrypt (`$2a$` / `$2b$` / `$2y$`).
 *
 * @returns {{ valid: boolean, migrateToHash?: string }}
 */
export function verifyPasswordForLogin(plain, storedHash) {
  const stored = String(storedHash || "");
  if (!stored) return { valid: false };

  if (stored.startsWith("scrypt:")) {
    if (!verifyLegacyScrypt(plain, stored)) return { valid: false };
    return { valid: true, migrateToHash: hashPasswordForStorage(plain) };
  }

  if (!bcrypt.compareSync(plain, stored)) return { valid: false };
  return { valid: true };
}
