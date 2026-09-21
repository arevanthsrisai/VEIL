import { readFileSync } from "node:fs";
import pg from "pg";

const BASE = "http://localhost:3000";
const url = readFileSync(".env.local", "utf8").split("=")[1].trim();

const c = new pg.Client({ connectionString: url });
await c.connect();
const { rows } = await c.query(`SELECT id FROM confessions WHERE status = 'APPROVED' LIMIT 1`);
await c.end();
const postId = rows[0]?.id;
console.log("approved post:", postId);

const reg = await fetch(`${BASE}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: `probe_${Date.now().toString(36)}`, password: "Password123!", nickname: "Probe" }),
});
const cookie = reg.headers.get("set-cookie")?.split(";")[0] ?? "";
console.log("register:", reg.status);

const report = await fetch(`${BASE}/api/reports`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie },
  body: JSON.stringify({ confessionId: postId, reason: "Spam" }),
});
console.log("report:", report.status);
console.log(await report.text());
