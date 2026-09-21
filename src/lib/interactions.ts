import { query } from "./db";
import type { PublicUser } from "./auth";
import type { ConfessionRow, ReactionCounts } from "./confessions";

export const ALLOWED_REACTION_EMOJI = ["🔥", "😂", "❤️", "😮", "😢", "👍", "💀"] as const;
export type AllowedEmoji = (typeof ALLOWED_REACTION_EMOJI)[number];

const ALLOWED_SET = new Set<string>(ALLOWED_REACTION_EMOJI);

export function isAllowedEmoji(emoji: unknown): emoji is AllowedEmoji {
  return typeof emoji === "string" && ALLOWED_SET.has(emoji);
}

export function validateReportReason(reason: unknown): string | null {
  if (typeof reason !== "string") return "Reason must be 1-500 characters.";
  const trimmed = reason.trim();
  if (trimmed.length < 1 || trimmed.length > 500) return "Reason must be 1-500 characters.";
  return null;
}

// ponytail: in-memory limiter, Redis if multi-instance
const REPORT_WINDOW_MS = 60 * 60 * 1000;
const REPORTS_PER_WINDOW = 10;
const reportBuckets = new Map<string, number[]>();

export function consumeReportQuota(userId: string, now: number = Date.now()): boolean {
  const times = (reportBuckets.get(userId) ?? []).filter((t) => t > now - REPORT_WINDOW_MS);
  if (times.length >= REPORTS_PER_WINDOW) {
    reportBuckets.set(userId, times);
    return false;
  }
  times.push(now);
  reportBuckets.set(userId, times);
  return true;
}

export function resetReportRateLimits(): void {
  reportBuckets.clear();
}

export function normalizeReactionCounts(
  rows: Array<{ emoji: string; count: number | string }>,
): ReactionCounts {
  const out: ReactionCounts = {};
  for (const row of rows) {
    const n = typeof row.count === "string" ? Number.parseInt(row.count, 10) : row.count;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) out[row.emoji] = n;
  }
  return out;
}

export function isConfessionVisibleTo(row: ConfessionRow, user: PublicUser): boolean {
  if (row.status === "APPROVED") return true;
  if (user.id === row.author_id) return true;
  return user.role === "MODERATOR" || user.role === "ADMIN";
}

export async function getReactionCounts(confessionId: string): Promise<ReactionCounts> {
  const { rows } = await query<{ emoji: string; count: number }>(
    `SELECT emoji, COUNT(*)::int AS count FROM reactions WHERE confession_id = $1 GROUP BY emoji`,
    [confessionId],
  );
  return normalizeReactionCounts(rows);
}

export async function toggleReaction(
  confessionId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  const { rows } = await query<{ reacted: boolean }>(
    `WITH ins AS (
       INSERT INTO reactions (confession_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING 1
     ),
     del AS (
       DELETE FROM reactions WHERE confession_id = $1 AND user_id = $2 AND emoji = $3
         AND NOT EXISTS (SELECT 1 FROM ins)
       RETURNING 1
     )
     SELECT EXISTS (SELECT 1 FROM ins) AS reacted`,
    [confessionId, userId, emoji],
  );
  return rows[0]?.reacted ?? false;
}

export async function createReport(input: {
  confessionId: string;
  reporterId: string;
  reason: string;
}): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO reports (confession_id, reporter_id, reason, status)
     VALUES ($1, $2, $3, 'OPEN')
     RETURNING id`,
    [input.confessionId, input.reporterId, input.reason],
  );
  return rows[0];
}
