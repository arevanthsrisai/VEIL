import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import {
  CONFESSIONS_DEFAULT_LIMIT,
  CONFESSIONS_MAX_LIMIT,
  toFeedItem,
  type ConfessionRow,
} from "@/lib/confessions";
import { query } from "@/lib/db";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to load popular confessions.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  let limit = CONFESSIONS_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number.parseInt(rawLimit, 10);
    limit = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), CONFESSIONS_MAX_LIMIT)
      : CONFESSIONS_DEFAULT_LIMIT;
  }

  try {
    const { rows } = await query<ConfessionRow>(
      `SELECT c.id, c.title, c.content, c.created_at, u.nickname, u.avatar_emoji,
              COALESCE(r.counts, '{}'::jsonb) AS reaction_counts,
              COALESCE(mr.emojis, '[]'::jsonb) AS my_reactions
       FROM confessions c
       JOIN users u ON u.id = c.author_id
       LEFT JOIN (
         SELECT confession_id, jsonb_object_agg(emoji, cnt) AS counts
         FROM (SELECT confession_id, emoji, COUNT(*)::int AS cnt FROM reactions GROUP BY confession_id, emoji) s
         GROUP BY confession_id
       ) r ON r.confession_id = c.id
       LEFT JOIN (
         SELECT confession_id, jsonb_agg(emoji) AS emojis FROM reactions WHERE user_id = $1 GROUP BY confession_id
       ) mr ON mr.confession_id = c.id
       LEFT JOIN (
         SELECT confession_id, COUNT(*)::int AS total FROM reactions GROUP BY confession_id
       ) rc ON rc.confession_id = c.id
       WHERE c.status = 'APPROVED'
       ORDER BY COALESCE(rc.total, 0) DESC, c.created_at DESC
       LIMIT $2`,
      [user.id, limit],
    );
    return NextResponse.json({ confessions: rows.map(toFeedItem) });
  } catch (err) {
    return dbError(err, "Failed to load popular confessions.");
  }
}
