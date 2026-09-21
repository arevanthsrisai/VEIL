import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";

const PORT = 54329;
const DB_NAME = "veil_dev";
const DATA_DIR = join(process.cwd(), ".pgdata");
const ENV_FILE = join(process.cwd(), ".env.local");

function readPassword() {
  if (existsSync(ENV_FILE)) {
    const m = readFileSync(ENV_FILE, "utf8").match(/DATABASE_URL=postgresql:\/\/postgres:([^@]+)@/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

async function applySchema(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  await client.query(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
  await client.end();
}

async function start() {
  let password = readPassword();
  const fresh = password === null;
  if (fresh) password = randomBytes(16).toString("hex");

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password,
    port: PORT,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (fresh || !existsSync(join(DATA_DIR, "PG_VERSION"))) {
    await pg.initialise();
    writeFileSync(ENV_FILE, `DATABASE_URL=postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${PORT}/${DB_NAME}\n`);
  }

  await pg.start();
  try {
    await pg.createDatabase(DB_NAME);
  } catch {
    // already exists
  }

  const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${PORT}/${DB_NAME}`;
  await applySchema(connectionString);
  writeFileSync(ENV_FILE, `DATABASE_URL=postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${PORT}/${DB_NAME}\n`);
  console.log(`READY postgres://127.0.0.1:${PORT}/${DB_NAME} (credentials in .env.local, gitignored)`);

  // keep alive: the postgres child processes are managed by this process
  setInterval(() => {}, 1 << 30);
}

function stop() {
  const pgCtl = join(process.cwd(), "node_modules", "@embedded-postgres", "windows-x64", "native", "bin", "pg_ctl.exe");
  try {
    execFileSync(pgCtl, ["-D", DATA_DIR, "stop", "-m", "fast"], { stdio: "inherit" });
    console.log("STOPPED");
  } catch {
    console.log("NOT RUNNING");
  }
}

const cmd = process.argv[2] ?? "start";
if (cmd === "stop") stop();
else if (cmd === "start") start().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
else {
  console.error("Usage: node scripts/dev-db.mjs [start|stop]");
  process.exit(1);
}
