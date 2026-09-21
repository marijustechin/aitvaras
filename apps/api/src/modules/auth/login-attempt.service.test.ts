import { describe, expect, it } from "vitest";
import { LoginAttemptService } from "./login-attempt.service";

function createService(): LoginAttemptService {
  const values: Record<string, string> = {
    LOGIN_MAX_ATTEMPTS: "3",
    LOGIN_WINDOW_SECONDS: "60",
    LOGIN_LOCKOUT_SECONDS: "120",
  };
  const config = {
    get: (key: string) => values[key],
  };
  return new LoginAttemptService(config as never);
}

describe("LoginAttemptService", () => {
  it("is not locked before any failure", () => {
    const service = createService();
    expect(service.isLocked(["user:alice"])).toBe(false);
  });

  it("locks a key at the configured threshold", () => {
    const service = createService();
    service.recordFailure(["user:alice"]);
    service.recordFailure(["user:alice"]);
    expect(service.isLocked(["user:alice"])).toBe(false);
    service.recordFailure(["user:alice"]);
    expect(service.isLocked(["user:alice"])).toBe(true);
  });

  it("locks if any of the provided keys is locked", () => {
    const service = createService();
    service.recordFailure(["ip:10.0.0.1"]);
    service.recordFailure(["ip:10.0.0.1"]);
    service.recordFailure(["ip:10.0.0.1"]);
    expect(service.isLocked(["user:someoneelse", "ip:10.0.0.1"])).toBe(true);
  });

  it("resets counters for a key", () => {
    const service = createService();
    service.recordFailure(["user:alice"]);
    service.recordFailure(["user:alice"]);
    service.reset(["user:alice"]);
    service.recordFailure(["user:alice"]);
    expect(service.isLocked(["user:alice"])).toBe(false);
  });

  it("expires the failure window", () => {
    const service = createService();
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    try {
      service.recordFailure(["user:alice"]);
      service.recordFailure(["user:alice"]);
      now += 61_000; // beyond the 60s window
      service.recordFailure(["user:alice"]);
      expect(service.isLocked(["user:alice"])).toBe(false);
    } finally {
      Date.now = originalNow;
    }
  });

  it("expires a lockout after the configured duration", () => {
    const service = createService();
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    try {
      service.recordFailure(["user:alice"]);
      service.recordFailure(["user:alice"]);
      service.recordFailure(["user:alice"]);
      expect(service.isLocked(["user:alice"])).toBe(true);
      now += 121_000; // beyond the 120s lockout
      expect(service.isLocked(["user:alice"])).toBe(false);
    } finally {
      Date.now = originalNow;
    }
  });

  it("clears all counters", () => {
    const service = createService();
    service.recordFailure(["user:alice"]);
    service.recordFailure(["user:alice"]);
    service.recordFailure(["user:alice"]);
    service.clearAll();
    expect(service.isLocked(["user:alice"])).toBe(false);
  });
});
