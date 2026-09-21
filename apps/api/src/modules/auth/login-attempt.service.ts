import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface AttemptRecord {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_SECONDS = 900;
const DEFAULT_LOCKOUT_SECONDS = 900;

/**
 * Process-local login brute-force protection.
 *
 * Tracks failures per key (username and client IP) within a sliding window and
 * temporarily locks a key after the configured threshold. This is intentionally
 * in-memory and therefore per-instance; it is appropriate for the current
 * single-instance foundation. A shared store (e.g. Redis) would be required for
 * multi-instance deployments.
 *
 * Lockouts are temporary and never reveal account existence to the caller.
 * Reset on successful login and expiry of the window.
 */
@Injectable()
export class LoginAttemptService {
  private readonly attempts = new Map<string, AttemptRecord>();

  constructor(private readonly config: ConfigService) {}

  private number(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private get maxAttempts(): number {
    return this.number("LOGIN_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS);
  }

  private get windowMs(): number {
    return this.number("LOGIN_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS) * 1000;
  }

  private get lockoutMs(): number {
    return this.number("LOGIN_LOCKOUT_SECONDS", DEFAULT_LOCKOUT_SECONDS) * 1000;
  }

  /** True if any of the given keys is currently locked. */
  isLocked(keys: string[]): boolean {
    const now = Date.now();
    return keys.some((key) => {
      const record = this.attempts.get(key);
      if (!record) {
        return false;
      }
      if (record.lockedUntil > 0) {
        if (now < record.lockedUntil) {
          return true;
        }
        this.attempts.delete(key);
        return false;
      }
      if (now - record.windowStartedAt > this.windowMs) {
        this.attempts.delete(key);
        return false;
      }
      return false;
    });
  }

  /** Record a failed attempt for each key, locking at the threshold. */
  recordFailure(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const record = this.attempts.get(key);
      if (!record || now - record.windowStartedAt > this.windowMs) {
        this.attempts.set(key, {
          failures: 1,
          windowStartedAt: now,
          lockedUntil: 0,
        });
        continue;
      }
      record.failures += 1;
      if (record.failures >= this.maxAttempts) {
        record.lockedUntil = now + this.lockoutMs;
      }
    }
  }

  /** Clear counters for the given keys (e.g. after a successful login). */
  reset(keys: string[]): void {
    for (const key of keys) {
      this.attempts.delete(key);
    }
  }

  /** Clear all counters. Used by tests and administrative resets. */
  clearAll(): void {
    this.attempts.clear();
  }
}
