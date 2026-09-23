import { query } from "./db";

// Self-contained copy of the confessions.ts feed pattern (types + mappers +
// reaction aggregation) so discovery queries don't couple to a file another
// agent may be editing. Shape matches the popular API response exactly.

export type DiscoveryConfessionRow = {
  id: string;
  title: string | null;
  content: string;
  created_at: string;
  nickname: string;
  avatar_emoji: string;
  reaction_counts: Record<string, number> | string | null;
  my_reactions?: string[] | string | null;
};

export type DiscoveryFeedItem = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  nickname: string;
  avatarEmoji: string;
  reactionCounts: Record<string, number>;
  myReactions?: string[];
};

function toReactionCounts(value: unknown): Record<string, number> {
  if (value === null || value === undefined) return {};
  if (typeof value === "string") {
    try {
      return toReactionCounts(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
    }
    return out;
  }
  return {};
}

function toMyReactions(value: unknown): string[] | undefined {
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

function toFeedItem(row: DiscoveryConfessionRow): DiscoveryFeedItem {
  const item: DiscoveryFeedItem = {
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

const REACTION_AGG = `LEFT JOIN (
      SELECT confession_id, jsonb_object_agg(emoji, cnt) AS counts
      FROM (SELECT confession_id, emoji, COUNT(*)::int AS cnt FROM reactions GROUP BY confession_id, emoji) s
      GROUP BY confession_id
    ) r ON r.confession_id = c.id`;

const MY_REACTIONS_JOIN = (userParam: number) =>
  `LEFT JOIN (SELECT confession_id, jsonb_agg(emoji) AS emojis FROM reactions WHERE user_id = $${userParam} GROUP BY confession_id) mr ON mr.confession_id = c.id`;

const FEED_SELECT = (userParam: number) => `SELECT c.id, c.title, c.content, c.created_at, u.nickname, u.avatar_emoji,
        COALESCE(r.counts, '{}'::jsonb) AS reaction_counts,
        COALESCE(mr.emojis, '[]'::jsonb) AS my_reactions
     FROM confessions c
     JOIN users u ON u.id = c.author_id
     ${REACTION_AGG}
     ${MY_REACTIONS_JOIN(userParam)}`;

export async function searchConfessions(
  q: string,
  limit: number,
  userId: string,
): Promise<DiscoveryFeedItem[]> {
  // ponytail: ILIKE seq scan, tsvector/GIN index if feed grows
  const { rows } = await query<DiscoveryConfessionRow>(
    `${FEED_SELECT(2)}
     WHERE c.status = 'APPROVED'
       AND (c.content ILIKE '%' || $1 || '%' OR c.title ILIKE '%' || $1 || '%')
     ORDER BY c.created_at DESC
     LIMIT $3`,
    [q, userId, limit],
  );
  return rows.map(toFeedItem);
}

export async function randomConfessions(
  limit: number,
  userId: string,
): Promise<DiscoveryFeedItem[]> {
  // ponytail: random() seq scan fine at this scale
  const { rows } = await query<DiscoveryConfessionRow>(
    `${FEED_SELECT(1)}
     WHERE c.status = 'APPROVED'
     ORDER BY random()
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map(toFeedItem);
}

export async function todayConfessions(
  limit: number,
  userId: string,
): Promise<DiscoveryFeedItem[]> {
  const { rows } = await query<DiscoveryConfessionRow>(
    `${FEED_SELECT(1)}
     WHERE c.status = 'APPROVED' AND c.created_at >= date_trunc('day', now())
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map(toFeedItem);
}
