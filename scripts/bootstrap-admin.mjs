import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const username = process.argv[2] ?? process.env.ADMIN_USERNAME;
const password = process.argv[3] ?? process.env.ADMIN_PASSWORD;
const nickname = process.argv[4] ?? process.env.ADMIN_NICKNAME ?? username;

if (!username || !password) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <username> <password> [nickname]");
  process.exit(1);
}
if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
  console.error("Username must be 3-20 characters: letters, numbers, underscores only.");
  process.exit(1);
}
if (password.length < 8 || password.length > 128) {
  console.error("Password must be 8-128 characters.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const password_hash = await bcrypt.hash(password, 10);
  const existing = await pool.query("SELECT id FROM users WHERE lower(username) = lower($1)", [username]);
  if (existing.rows.length > 0) {
    await pool.query("UPDATE users SET password_hash = $1, role = 'ADMIN' WHERE id = $2", [
      password_hash,
      existing.rows[0].id,
    ]);
    console.log(`Promoted user to ADMIN (id: ${existing.rows[0].id}).`);
  } else {
    const { rows } = await pool.query(
      "INSERT INTO users (username, password_hash, nickname, avatar_emoji, role) VALUES ($1, $2, $3, $4, 'ADMIN') RETURNING id",
      [username, password_hash, nickname, "🎭"],
    );
    console.log(`Created ADMIN user (id: ${rows[0].id}).`);
  }
} finally {
  await pool.end();
}
