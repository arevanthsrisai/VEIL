import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import pg from "pg";

const raw = readFileSync(".env.local", "utf8").trim();
const url = raw.slice(raw.indexOf("=") + 1).replace(/^"|"$/g, "");
const host = new URL(url).host;
console.log("target host:", host.split(".")[1] ?? host, "| db:", new URL(url).pathname.slice(1));

const c = new pg.Client({ connectionString: url });
await c.connect();

console.log("dropping all tables…");
await c.query(`DROP TABLE IF EXISTS audit_logs, borrow_items, bookmarks, poll_votes, polls, site_settings, notifications, moderation_actions, reports, reactions, sessions, confessions, users CASCADE`);
console.log("re-applying schema…");
await c.query(readFileSync("db/schema.sql", "utf8"));

const username = process.argv[2];
const password = process.argv[3];
if (!username || !password) {
  console.error("usage: node scripts/db-reset.mjs <admin-username> <admin-password>");
  process.exit(1);
}
const hash = await bcrypt.hash(password, 10);
const { rows } = await c.query(
  `INSERT INTO users (username, password_hash, nickname, avatar_emoji, role, must_change_password)
   VALUES ($1, $2, $3, $4, 'ADMIN', true)
   RETURNING id, nickname, role`,
  [username, hash, "The Veil", "🎭"],
);
console.log("seeded admin:", rows[0].nickname, rows[0].role, "(must_change_password: true)");

const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
console.log("tables after reset:", t.rows.map((r) => r.table_name).join(","));
const u = await c.query(`SELECT COUNT(*)::int AS n FROM users`);
console.log("users:", u.rows[0].n);
await c.end();
console.log("RESET COMPLETE");
