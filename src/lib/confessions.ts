import { query } from "./db";
import type { PublicUser } from "./auth";

export type ConfessionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReactionCounts = Record<string, number>;

export type ConfessionItem = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  nickname: string;
  avatarEmoji: string;
  reactionCounts: ReactionCounts;
  myReactions?: string[];
};

export type ConfessionDetail = ConfessionItem & {
  status: ConfessionStatus;
  rejectionReason?: string | null;
  isOwn: boolean;
};

export type ConfessionRow = {
  id: string;
  title: string | null;
  content: string;
  status: ConfessionStatus;
  rejection_reason: string | null;
  created_at: string;
  author_id: string;
  nickname: string;
  avatar_emoji: string;
  reaction_counts: ReactionCounts | string | null;
  my_reactions?: string[] | string | null;
};

export const CONFESSIONS_DEFAULT_LIMIT = 20;
export const CONFESSIONS_MAX_LIMIT = 50;

export function validateConfessionContent(content: unknown): string | null {
  if (typeof content !== "string") return "Content must be 1-5000 characters.";
  const trimmed = content.trim();
  if (trimmed.length < 1 || trimmed.length > 5000) return "Content must be 1-5000 characters.";
  return null;
}

export function validateConfessionTitle(title: unknown): string | null {
  if (title === undefined || title === null) return null;
  if (typeof title !== "string" || title.length > 120)
    return "Title must be at most 120 characters.";
  return null;
}

export function normalizeConfessionTitle(title: unknown): string | null {
  if (typeof title !== "string") return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ponytail: in-memory limiter, Redis if multi-instance
const CONFESSION_WINDOW_MS = 60 * 60 * 1000;
const CONFESSIONS_PER_WINDOW = 5;
const confessionBuckets = new Map<string, number[]>();

export function consumeConfessionQuota(userId: string, now: number = Date.now()): boolean {
  const times = (confessionBuckets.get(userId) ?? []).filter((t) => t > now - CONFESSION_WINDOW_MS);
  if (times.length >= CONFESSIONS_PER_WINDOW) {
    confessionBuckets.set(userId, times);
    return false;
  }
  times.push(now);
  confessionBuckets.set(userId, times);
  return true;
}

export function resetConfessionRateLimits(): void {
  confessionBuckets.clear();
}

export function toReactionCounts(value: unknown): ReactionCounts {
  if (value === null || value === undefined) return {};
  if (typeof value === "string") {
    try {
      return toReactionCounts(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const out: ReactionCounts = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
    }
    return out;
  }
  return {};
}

export function toMyReactions(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  let list: unknown = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list) as unknown;
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(list)) return undefined;
  return list.filter((e): e is string => typeof e === "string");
}

export function toFeedItem(row: ConfessionRow): ConfessionItem {
  const item: ConfessionItem = {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    nickname: row.nickname,
    avatarEmoji: row.avatar_emoji,
    reactionCounts: toReactionCounts(row.reaction_counts),
  };
  const myReactions = toMyReactions(row.my_reactions);
  if (myReactions) item.myReactions = myReactions;
  return item;
}

export function toConfessionDetail(row: ConfessionRow, user: PublicUser): ConfessionDetail {
  const isOwn = user.id === row.author_id;
  const privileged = isOwn || user.role === "MODERATOR" || user.role === "ADMIN";
  const detail: ConfessionDetail = {
    ...toFeedItem(row),
    status: row.status,
    isOwn,
  };
  if (privileged) detail.rejectionReason = row.rejection_reason;
  return detail;
}

const REACTION_AGG = `LEFT JOIN (
      SELECT confession_id, jsonb_object_agg(emoji, cnt) AS counts
      FROM (SELECT confession_id, emoji, COUNT(*)::int AS cnt FROM reactions GROUP BY confession_id, emoji) s
      GROUP BY confession_id
    ) r ON r.confession_id = c.id`;

export async function listApprovedConfessions(
  limit: number,
  cursor: string | null,
  userId: string | null,
): Promise<{ confessions: ConfessionItem[]; nextCursor: string | null }> {
  const params: unknown[] = [];
  let cursorFilter = "";
  if (cursor !== null) {
    params.push(cursor);
    cursorFilter = `AND c.created_at < $${params.length}::timestamptz`;
  }
  let mineJoin = "";
  let mineSelect = "'[]'::jsonb AS my_reactions";
  if (userId !== null) {
    params.push(userId);
    mineJoin = `LEFT JOIN (SELECT confession_id, jsonb_agg(emoji) AS emojis FROM reactions WHERE user_id = $${params.length} GROUP BY confession_id) mr ON mr.confession_id = c.id`;
    mineSelect = "COALESCE(mr.emojis, '[]'::jsonb) AS my_reactions";
  }
  params.push(limit);
  const { rows } = await query<ConfessionRow>(
    `SELECT c.id, c.title, c.content, c.created_at, u.nickname, u.avatar_emoji,
            COALESCE(r.counts, '{}'::jsonb) AS reaction_counts, ${mineSelect}
     FROM confessions c
     JOIN users u ON u.id = c.author_id
     ${REACTION_AGG}
     ${mineJoin}
     WHERE c.status = 'APPROVED' ${cursorFilter}
     ORDER BY c.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  const confessions = rows.map(toFeedItem);
  const nextCursor =
    confessions.length === limit && confessions.length > 0
      ? confessions[confessions.length - 1].createdAt
      : null;
  return { confessions, nextCursor };
}

export async function getConfessionById(
  id: string,
  userId: string | null,
): Promise<ConfessionRow | null> {
  const params: unknown[] = [id];
  let mineJoin = "";
  let mineSelect = "'[]'::jsonb AS my_reactions";
  if (userId !== null) {
    params.push(userId);
    mineJoin = `LEFT JOIN (SELECT confession_id, jsonb_agg(emoji) AS emojis FROM reactions WHERE user_id = $2 GROUP BY confession_id) mr ON mr.confession_id = c.id`;
    mineSelect = "COALESCE(mr.emojis, '[]'::jsonb) AS my_reactions";
  }
  const { rows } = await query<ConfessionRow>(
    `SELECT c.id, c.title, c.content, c.status, c.rejection_reason, c.created_at, c.author_id,
            u.nickname, u.avatar_emoji,
            COALESCE(r.counts, '{}'::jsonb) AS reaction_counts, ${mineSelect}
     FROM confessions c
     JOIN users u ON u.id = c.author_id
     LEFT JOIN (
       SELECT confession_id, jsonb_object_agg(emoji, cnt) AS counts
       FROM (
         SELECT confession_id, emoji, COUNT(*)::int AS cnt
         FROM reactions WHERE confession_id = $1
         GROUP BY confession_id, emoji
       ) s
       GROUP BY confession_id
     ) r ON r.confession_id = c.id
     ${mineJoin}
     WHERE c.id = $1`,
    params,
  );
  return rows[0] ?? null;
}

export async function createConfession(
  authorId: string,
  title: string | null,
  content: string,
): Promise<{ id: string; status: ConfessionStatus }> {
  const { rows } = await query<{ id: string; status: ConfessionStatus }>(
    `INSERT INTO confessions (author_id, title, content, status)
     VALUES ($1, $2, $3, 'PENDING')
     RETURNING id, status`,
    [authorId, title, content],
  );
  return rows[0];
}
