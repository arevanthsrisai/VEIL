import { query } from "./db";
import { toFeedItem, type ConfessionItem, type ConfessionRow } from "./confessions";

export async function bookmarkConfession(
  userId: string,
  confessionId: string,
): Promise<boolean> {
  const { rows } = await query<unknown>(
    `INSERT INTO bookmarks (user_id, confession_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING 1`,
    [userId, confessionId],
  );
  return rows.length > 0;
}

export async function unbookmarkConfession(userId: string, confessionId: string): Promise<void> {
  await query("DELETE FROM bookmarks WHERE user_id = $1 AND confession_id = $2", [
    userId,
    confessionId,
  ]);
}

type BookmarkRow = ConfessionRow & { bookmarked_at: string };

export async function listBookmarkedConfessions(
  userId: string,
  cursor: string | null,
  limit: number,
): Promise<{ confessions: ConfessionItem[]; nextCursor: string | null }> {
  const params: unknown[] = [userId];
  let cursorFilter = "";
  if (cursor !== null) {
    params.push(cursor);
    cursorFilter = `AND b.created_at < $${params.length}::timestamptz`;
  }
  params.push(userId);
  const mineJoin = `LEFT JOIN (SELECT confession_id, jsonb_agg(emoji) AS emojis FROM reactions WHERE user_id = $${params.length} GROUP BY confession_id) mr ON mr.confession_id = c.id`;
  params.push(limit);
  const { rows } = await query<BookmarkRow>(
    `SELECT c.id, c.title, c.content, c.created_at, u.nickname, u.avatar_emoji,
            COALESCE(r.counts, '{}'::jsonb) AS reaction_counts,
            COALESCE(mr.emojis, '[]'::jsonb) AS my_reactions,
            b.created_at AS bookmarked_at
     FROM bookmarks b
     JOIN confessions c ON c.id = b.confession_id AND c.status = 'APPROVED'
     JOIN users u ON u.id = c.author_id
     LEFT JOIN (
       SELECT confession_id, jsonb_object_agg(emoji, cnt) AS counts
       FROM (SELECT confession_id, emoji, COUNT(*)::int AS cnt FROM reactions GROUP BY confession_id, emoji) s
       GROUP BY confession_id
     ) r ON r.confession_id = c.id
     ${mineJoin}
     WHERE b.user_id = $1 ${cursorFilter}
     ORDER BY b.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  const confessions = rows.map(toFeedItem);
  const nextCursor =
    rows.length === limit && rows.length > 0
      ? new Date(rows[rows.length - 1].bookmarked_at).toISOString()
      : null;
  return { confessions, nextCursor };
}
