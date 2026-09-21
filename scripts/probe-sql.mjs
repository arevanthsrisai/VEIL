import { readFileSync } from "node:fs";
import pg from "pg";

const url = readFileSync(".env.local", "utf8").split("=")[1].trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const id = "00000000-0000-0000-0000-000000000000";
const userId = "00000000-0000-0000-0000-000000000000";
try {
  const { rows } = await c.query(
    `SELECT c.id, c.title, c.content, c.status, c.rejection_reason, c.created_at, c.author_id,
            u.nickname, u.avatar_emoji,
            COALESCE(r.counts, '{}'::jsonb) AS reaction_counts, '[]'::jsonb AS my_reactions
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
     WHERE c.id = $1`,
    [id, userId],
  );
  console.log("OK rows:", rows.length);
} catch (e) {
  console.log("SQL ERROR:", e.message);
}
await c.end();
