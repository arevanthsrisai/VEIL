import { describe, expect, it } from "vitest";
import {
  hashToken,
  validateAvatarEmoji,
  validateNickname,
  validatePassword,
  validateUsername,
} from "./auth";

describe("validateUsername", () => {
  it("accepts valid usernames", () => {
    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername("user_123")).toBeNull();
    expect(validateUsername("A".repeat(20))).toBeNull();
  });
  it("rejects short, long, or bad-charset usernames", () => {
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("A".repeat(21))).not.toBeNull();
    expect(validateUsername("has space")).not.toBeNull();
    expect(validateUsername("dash-name")).not.toBeNull();
    expect(validateUsername("")).not.toBeNull();
  });
  it("rejects non-strings", () => {
    expect(validateUsername(null)).not.toBeNull();
    expect(validateUsername(undefined)).not.toBeNull();
    expect(validateUsername(123)).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("accepts 8+ char passwords", () => {
    expect(validatePassword("password")).toBeNull();
    expect(validatePassword("a".repeat(128))).toBeNull();
  });
  it("rejects short or overlong passwords", () => {
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("")).not.toBeNull();
    expect(validatePassword("a".repeat(129))).not.toBeNull();
  });
  it("rejects non-strings", () => {
    expect(validatePassword(null)).not.toBeNull();
    expect(validatePassword(12345678)).not.toBeNull();
  });
});

describe("validateNickname", () => {
  it("accepts 1-30 chars and trims", () => {
    expect(validateNickname("Ghost")).toBeNull();
    expect(validateNickname("  Ghost  ")).toBeNull();
    expect(validateNickname("n".repeat(30))).toBeNull();
  });
  it("rejects empty, blank, or overlong nicknames", () => {
    expect(validateNickname("")).not.toBeNull();
    expect(validateNickname("   ")).not.toBeNull();
    expect(validateNickname("n".repeat(31))).not.toBeNull();
  });
  it("rejects non-strings", () => {
    expect(validateNickname(null)).not.toBeNull();
    expect(validateNickname(42)).not.toBeNull();
  });
});

describe("validateAvatarEmoji", () => {
  it("accepts undefined default and short emoji", () => {
    expect(validateAvatarEmoji(undefined)).toBeNull();
    expect(validateAvatarEmoji("🎭")).toBeNull();
  });
  it("rejects empty or overlong values", () => {
    expect(validateAvatarEmoji("")).not.toBeNull();
    expect(validateAvatarEmoji("x".repeat(17))).not.toBeNull();
  });
});

describe("hashToken", () => {
  it("is deterministic and 64 hex chars", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("differs per input", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});
