import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes with Argon2id and verifies the correct password", async () => {
    const password = "correct horse battery staple";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toContain(password);
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const passwordHash = await hashPassword("s3cret-password");
    await expect(verifyPassword(passwordHash, "wrong-password")).resolves.toBe(
      false,
    );
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(
      false,
    );
  });
});
