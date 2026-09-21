import { describe, expect, it } from "vitest";
import {
  isAdmin,
  isStaff,
  toExcerpt,
  validateModerationAction,
  validateRejectionReason,
  validateReportAction,
  validateRoleValue,
} from "./moderation";

describe("isStaff", () => {
  it("allows moderators and admins only", () => {
    const base = { id: "u", nickname: "n", avatar_emoji: "🎭" as const, role: "USER" as const };
    expect(isStaff({ ...base, role: "USER" })).toBe(false);
    expect(isStaff({ ...base, role: "MODERATOR" })).toBe(true);
    expect(isStaff({ ...base, role: "ADMIN" })).toBe(true);
    expect(isStaff(null)).toBe(false);
  });
});

describe("isAdmin", () => {
  it("allows admins only", () => {
    const base = { id: "u", nickname: "n", avatar_emoji: "🎭" as const, role: "USER" as const };
    expect(isAdmin({ ...base, role: "MODERATOR" })).toBe(false);
    expect(isAdmin({ ...base, role: "ADMIN" })).toBe(true);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("validateModerationAction", () => {
  it("accepts APPROVED and REJECTED", () => {
    expect(validateModerationAction("APPROVED")).toBe(true);
    expect(validateModerationAction("REJECTED")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(validateModerationAction("PENDING")).toBe(false);
    expect(validateModerationAction("")).toBe(false);
    expect(validateModerationAction(null)).toBe(false);
  });
});

describe("validateReportAction", () => {
  it("accepts RESOLVED and DISMISSED", () => {
    expect(validateReportAction("RESOLVED")).toBe(true);
    expect(validateReportAction("DISMISSED")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(validateReportAction("OPEN")).toBe(false);
    expect(validateReportAction(null)).toBe(false);
  });
});

describe("validateRejectionReason", () => {
  it("accepts 1-500 chars", () => {
    expect(validateRejectionReason("spam")).toBeNull();
    expect(validateRejectionReason("x".repeat(500))).toBeNull();
  });
  it("rejects empty, blank, overlong, non-strings", () => {
    expect(validateRejectionReason("")).not.toBeNull();
    expect(validateRejectionReason("   ")).not.toBeNull();
    expect(validateRejectionReason("x".repeat(501))).not.toBeNull();
    expect(validateRejectionReason(undefined)).not.toBeNull();
    expect(validateRejectionReason(42)).not.toBeNull();
  });
});

describe("validateRoleValue", () => {
  it("accepts USER, MODERATOR, ADMIN", () => {
    expect(validateRoleValue("USER")).toBe(true);
    expect(validateRoleValue("MODERATOR")).toBe(true);
    expect(validateRoleValue("ADMIN")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(validateRoleValue("SUPERADMIN")).toBe(false);
    expect(validateRoleValue("user")).toBe(false);
    expect(validateRoleValue(null)).toBe(false);
  });
});

describe("toExcerpt", () => {
  it("truncates to 140 chars", () => {
    expect(toExcerpt("x".repeat(200))).toBe("x".repeat(140));
    expect(toExcerpt("short")).toBe("short");
  });
  it("returns null for missing content", () => {
    expect(toExcerpt(null)).toBeNull();
    expect(toExcerpt(undefined)).toBeNull();
    expect(toExcerpt("")).toBeNull();
  });
});
