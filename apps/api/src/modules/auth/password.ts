import { Algorithm, hash, verify } from "@node-rs/argon2";

/**
 * Argon2id parameters (OWASP-recommended baseline).
 *
 * m = 19 MiB memory, t = 2 iterations, p = 1. Tune upward only with a recorded
 * decision; changing these invalidates nothing (hashes encode their own
 * parameters) but new hashes use the new settings.
 */
export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hash a plaintext password. Never log or return the input. */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against a stored hash using the hashing library.
 * Returns false on any error (including malformed hashes) rather than throwing.
 */
export async function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}
