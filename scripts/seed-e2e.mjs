import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import pg from "pg";

const raw = readFileSync(".env.local", "utf8").trim();
const url = raw.slice(raw.indexOf("=") + 1).replace(/^"|"$/g, "");
const c = new pg.Client({ connectionString: url });
await c.connect();

const hash = await bcrypt.hash("Password123!", 10);
const { rows: u } = await c.query(
  `INSERT INTO users (username, password_hash, nickname, avatar_emoji, role)
   VALUES ($1, $2, $3, $4, 'USER')
   ON CONFLICT DO NOTHING
   RETURNING id`,
  ["seed_user", hash, "Seed Ghost", "🌱"],
);
const userId = u[0]?.id ?? (await c.query(`SELECT id FROM users WHERE username = 'seed_user'`)).rows[0].id;

const { rows: existing } = await c.query(`SELECT id FROM confessions WHERE author_id = $1 LIMIT 1`, [userId]);
if (existing.length === 0) {
  await c.query(
    `INSERT INTO confessions (author_id, title, content, status)
     VALUES ($1, $2, $3, 'APPROVED')`,
    [userId, "Seeded approved post", "This is a seeded APPROVED post for E2E reactions and reporting tests."],
  );
  console.log("seeded approved post");
} else {
  console.log("approved post already exists");
}
await c.end();
