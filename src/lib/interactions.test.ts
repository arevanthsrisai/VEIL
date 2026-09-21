import { describe, expect, it } from "vitest";
import {
  consumeReportQuota,
  isAllowedEmoji,
  isConfessionVisibleTo,
  normalizeReactionCounts,
  resetReportRateLimits,
  validateReportReason,
} from "./interactions";

describe("validateReportReason", () => {
  it("accepts 1-500 chars", () => {
    expect(validateReportReason("spam")).toBeNull();
    expect(validateReportReason("x".repeat(500))).toBeNull();
  });
  it("rejects empty, blank, overlong, non-strings", () => {
    expect(validateReportReason("")).not.toBeNull();
    expect(validateReportReason("   ")).not.toBeNull();
    expect(validateReportReason("x".repeat(501))).not.toBeNull();
    expect(validateReportReason(undefined)).not.toBeNull();
  });
});

describe("isAllowedEmoji", () => {
  it("accepts the whitelist", () => {
    for (const e of ["🔥", "😂", "❤️", "😮", "😢", "👍", "💀"]) expect(isAllowedEmoji(e)).toBe(true);
  });
  it("rejects others", () => {
    expect(isAllowedEmoji("💩")).toBe(false);
    expect(isAllowedEmoji("")).toBe(false);
    expect(isAllowedEmoji(null)).toBe(false);
  });
});

describe("normalizeReactionCounts", () => {
  it("omits zero counts", () => {
    expect(
      normalizeReactionCounts([
        { emoji: "🔥", count: 2 },
        { emoji: "😂", count: 0 },
      ]),
    ).toEqual({ "🔥": 2 });
  });
});

describe("report quota", () => {
  it("allows 10 per hour then 429s", () => {
    resetReportRateLimits();
    for (let i = 0; i < 10; i++) expect(consumeReportQuota("u1", 0)).toBe(true);
    expect(consumeReportQuota("u1", 0)).toBe(false);
    expect(consumeReportQuota("u1", 60 * 60 * 1000 + 1)).toBe(true);
  });
});

describe("isConfessionVisibleTo", () => {
  const base = {
    id: "c",
    title: null,
    content: "x",
    rejection_reason: null,
    created_at: new Date().toISOString(),
    author_id: "author",
    nickname: "n",
    avatar_emoji: "🎭",
    reaction_counts: {},
  };
  it("approved is visible to anyone", () => {
    expect(
      isConfessionVisibleTo(
        { ...base, status: "APPROVED" },
        { id: "other", nickname: "n", avatar_emoji: "🎭", role: "USER" },
      ),
    ).toBe(true);
  });
  it("pending is hidden from strangers but visible to author and mods", () => {
    const row = { ...base, status: "PENDING" as const };
    const stranger = { id: "other", nickname: "n", avatar_emoji: "🎭", role: "USER" as const };
    expect(isConfessionVisibleTo(row, stranger)).toBe(false);
    expect(
      isConfessionVisibleTo(row, { id: "author", nickname: "n", avatar_emoji: "🎭", role: "USER" }),
    ).toBe(true);
    expect(
      isConfessionVisibleTo(row, {
        id: "mod",
        nickname: "n",
        avatar_emoji: "🎭",
        role: "MODERATOR",
      }),
    ).toBe(true);
  });
});
