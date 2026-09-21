import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(".env.local", "utf8").trim();
const url = raw.slice(raw.indexOf("=") + 1).replace(/^"|"$/g, "");
const c = new pg.Client({ connectionString: url });
await c.connect();
const v = await c.query("select version()");
console.log("VERSION:", v.rows[0].version.split(",")[0]);
const t = await c.query("select table_name from information_schema.tables where table_schema='public' order by 1");
console.log(`TABLES(${t.rows.length}):`, t.rows.map((r) => r.table_name).join(","));
const i = await c.query("select indexname from pg_indexes where schemaname='public' order by 1");
console.log(`INDEXES(${i.rows.length}):`, i.rows.map((r) => r.indexname).join(","));
const cols = await c.query("select count(*)::int as n from information_schema.columns where table_schema='public'");
console.log("COLUMNS:", cols.rows[0].n);
await c.end();
