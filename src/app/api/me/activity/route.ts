import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import {
  toFeedItem,
  type ConfessionItem,
  type ConfessionRow,
  type ConfessionStatus,
} from "@/lib/confessions";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const ACTIVITY_LIMIT = 50;

type OwnConfessionItem = ConfessionItem & {
  status: ConfessionStatus;
  rejectionReason?: string | null;
};

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to load activity.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const confessionRes = await query<ConfessionRow>(
      `SELECT c.id, c.title, c.content, c.status, c.rejection_reason, c.created_at, c.author_id,
              u.nickname, u.avatar_emoji,
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
       WHERE c.author_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [user.id, ACTIVITY_LIMIT],
    );

    const confessions: OwnConfessionItem[] = confessionRes.rows.map((row) => {
      const item = toFeedItem(row) as OwnConfessionItem;
      item.status = row.status;
      if (row.status === "REJECTED") item.rejectionReason = row.rejection_reason ?? null;
      return item;
    });

    return NextResponse.json({ confessions });
  } catch (err) {
    return dbError(err, "Failed to load activity.");
  }
}
